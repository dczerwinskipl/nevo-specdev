import { describe, expect, it } from 'vitest';

import { parsePolicy, type RepositoryPolicy } from '../../src/domain/policy.js';
import { desiredRuleset, normalizeRules, rulesFor } from '../../src/domain/ruleset.js';

const policy: RepositoryPolicy = parsePolicy(
  JSON.stringify({
    merge: {},
    pullRequest: { required_approving_review_count: 1 },
    requiredStatusChecks: { strict: true, doNotEnforceOnCreate: true, checks: ['quality', 'test'] },
    rulesets: [
      {
        name: 'protected-main',
        target: 'branch',
        enforcement: 'active',
        conditions: { ref_name: { include: ['refs/heads/main'], exclude: [] } },
        baseRules: [{ type: 'deletion' }, { type: 'non_fast_forward' }],
      },
    ],
  }),
);

describe('rulesFor / desiredRuleset', () => {
  it('appends the pull_request rule with the effective params, then required_status_checks', () => {
    const rules = rulesFor(policy.rulesets[0]!, policy, { required_approving_review_count: 0 });
    expect(rules).toEqual([
      { type: 'deletion' },
      { type: 'non_fast_forward' },
      { type: 'pull_request', parameters: { required_approving_review_count: 0 } },
      {
        type: 'required_status_checks',
        parameters: {
          strict_required_status_checks_policy: true,
          do_not_enforce_on_create: true,
          required_status_checks: [{ context: 'quality' }, { context: 'test' }],
        },
      },
    ]);
  });

  it('desiredRuleset carries name/target/enforcement/conditions and an empty bypass list', () => {
    const rs = desiredRuleset(policy.rulesets[0]!, policy, {});
    expect(rs).toMatchObject({ name: 'protected-main', target: 'branch', bypass_actors: [] });
  });
});

describe('normalizeRules', () => {
  it('keeps type + parameters and drops server noise', () => {
    expect(
      normalizeRules([
        { type: 'deletion', ruleset_source_type: 'Repository', extra: 1 },
        { type: 'pull_request', parameters: { x: 1 }, id: 42 },
      ]),
    ).toEqual([{ type: 'deletion' }, { type: 'pull_request', parameters: { x: 1 } }]);
  });
});
