// Pure construction of the desired ruleset payload from the policy + the
// effective PR-review parameters.

import type { RepositoryPolicy, RulesetSpec } from './policy.js';

export interface DesiredRuleset {
  readonly name: string;
  readonly target: string;
  readonly enforcement: string;
  readonly conditions: unknown;
  readonly bypass_actors: unknown[];
  readonly rules: unknown[];
}

export function rulesFor(
  spec: RulesetSpec,
  policy: RepositoryPolicy,
  prParams: Record<string, unknown>,
): unknown[] {
  const rules: unknown[] = (spec.baseRules ?? []).map((r) => ({ ...r }));
  rules.push({ type: 'pull_request', parameters: { ...prParams } });

  const rsc = policy.requiredStatusChecks;
  if (rsc && Array.isArray(rsc.checks) && rsc.checks.length > 0) {
    rules.push({
      type: 'required_status_checks',
      parameters: {
        strict_required_status_checks_policy: rsc.strict !== false,
        do_not_enforce_on_create: rsc.doNotEnforceOnCreate === true,
        required_status_checks: rsc.checks.map((context) => ({ context })),
      },
    });
  }
  return rules;
}

export function desiredRuleset(
  spec: RulesetSpec,
  policy: RepositoryPolicy,
  prParams: Record<string, unknown>,
): DesiredRuleset {
  return {
    name: spec.name,
    target: spec.target,
    enforcement: spec.enforcement,
    conditions: spec.conditions,
    bypass_actors: spec.bypass_actors ?? [],
    rules: rulesFor(spec, policy, prParams),
  };
}

/** Strip server-added noise so a stored ruleset compares cleanly against the policy. */
export function normalizeRules(rules: unknown): unknown[] {
  if (!Array.isArray(rules)) return [];
  return rules.map((r) => {
    const rule = (typeof r === 'object' && r !== null ? r : {}) as {
      type?: unknown;
      parameters?: unknown;
    };
    return rule.parameters ? { type: rule.type, parameters: rule.parameters } : { type: rule.type };
  });
}
