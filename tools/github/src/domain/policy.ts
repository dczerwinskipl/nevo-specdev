// The desired-state policy + the pure PR-review decision.
//
// The durable target is one approval. A 0-approval "bootstrap exception" is
// allowed ONLY when reviewer eligibility was read successfully AND proves fewer
// than two collaborators could cast a counting approval. If eligibility could
// not be determined, the answer is `unverifiable` — the caller refuses to touch
// the policy rather than guess.

import { UsageError } from '../errors.js';

export interface RulesetSpec {
  readonly name: string;
  readonly target: string;
  readonly enforcement: string;
  readonly conditions: unknown;
  readonly bypass_actors?: unknown[];
  readonly baseRules?: { type: string }[];
}

export interface RepositoryPolicy {
  readonly merge: Record<string, unknown>;
  readonly pullRequest: Record<string, unknown>;
  readonly requiredStatusChecks?: {
    readonly strict?: boolean;
    readonly doNotEnforceOnCreate?: boolean;
    readonly checks?: string[];
  };
  readonly rulesets: RulesetSpec[];
}

/** Parse + minimally validate a repository-policy.json document. */
export function parsePolicy(raw: string): RepositoryPolicy {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new UsageError(`repository-policy.json is not valid JSON: ${String(err)}`, {
      cause: err,
    });
  }
  const p = parsed as Partial<RepositoryPolicy>;
  if (!p.merge || !p.pullRequest || !Array.isArray(p.rulesets)) {
    throw new UsageError('repository-policy.json must have `merge`, `pullRequest` and `rulesets`');
  }
  return p as RepositoryPolicy;
}

/** Drop `$comment` (and any other `$`-prefixed) keys — they are not GitHub fields. */
export function stripMeta(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => !k.startsWith('$')));
}

export type ReviewerDiscovery =
  | { readonly ok: true; readonly eligible: string[] }
  | { readonly ok: false; readonly reason: string };

export type PrReviewDecision =
  | {
      readonly kind: 'target';
      readonly params: Record<string, unknown>;
      readonly target: Record<string, unknown>;
      readonly exception: null;
    }
  | {
      readonly kind: 'bootstrap';
      readonly params: Record<string, unknown>;
      readonly target: Record<string, unknown>;
      readonly exception: string;
    }
  | {
      readonly kind: 'unverifiable';
      readonly target: Record<string, unknown>;
      readonly reason: string;
    };

export function decidePrReviewPolicy({
  target,
  discovery,
}: {
  target: Record<string, unknown>;
  discovery: ReviewerDiscovery;
}): PrReviewDecision {
  if (!discovery.ok) {
    return {
      kind: 'unverifiable',
      target,
      reason:
        `could not determine reviewer eligibility (${discovery.reason}). ` +
        `Refusing to change the PR-review policy on a guess — fix access to the ` +
        `collaborators API and re-run. The 0-approval bootstrap exception is only ` +
        `applied when the API is readable and shows fewer than two eligible reviewers.`,
    };
  }

  if (discovery.eligible.length >= 2) {
    return { kind: 'target', params: { ...target }, target, exception: null };
  }

  const who = discovery.eligible.join(', ') || '(none)';
  const n = discovery.eligible.length;
  return {
    kind: 'bootstrap',
    params: {
      ...target,
      required_approving_review_count: 0,
      require_last_push_approval: false, // moot at 0, and GitHub rejects true+0
    },
    target,
    exception:
      `only ${String(n)} eligible reviewer${n === 1 ? '' : 's'} (${who}); an author cannot ` +
      `approve their own PR. Add a second collaborator with write access and re-run — the ` +
      `policy file needs no edit.`,
  };
}
