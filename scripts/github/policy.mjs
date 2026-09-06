// Pure decision for the PR-review ruleset parameters. No `gh`, no I/O — the
// caller does reviewer discovery and passes the result in, so this stays
// unit-testable and cannot fail open (BLOCKER #5).
//
// The durable target is one approval. A 0-approval "bootstrap exception" is
// allowed ONLY when reviewer eligibility was read successfully AND proves there
// are fewer than two collaborators who could cast a counting approval (an author
// cannot approve their own PR). If eligibility could not be determined, the
// answer is `unverifiable` — the caller must refuse to touch the policy rather
// than guess.

/**
 * @typedef {{ ok: true, eligible: string[] } | { ok: false, reason: string }} ReviewerDiscovery
 * @typedef {(
 *   | { kind: 'target', params: Record<string, unknown>, target: Record<string, unknown>, exception: null }
 *   | { kind: 'bootstrap', params: Record<string, unknown>, target: Record<string, unknown>, exception: string }
 *   | { kind: 'unverifiable', target: Record<string, unknown>, reason: string }
 * )} PrReviewDecision
 */

/**
 * @param {object} o
 * @param {Record<string, unknown>} o.target   the durable pull_request parameters (already stripped of `$meta`)
 * @param {ReviewerDiscovery} o.discovery
 * @returns {PrReviewDecision}
 */
export function decidePrReviewPolicy({ target, discovery }) {
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
  return {
    kind: 'bootstrap',
    params: {
      ...target,
      required_approving_review_count: 0,
      require_last_push_approval: false, // moot at 0, and GitHub rejects true+0
    },
    target,
    exception:
      `only ${discovery.eligible.length} eligible reviewer` +
      `${discovery.eligible.length === 1 ? '' : 's'} (${who}); an author cannot approve ` +
      `their own PR. Add a second collaborator with write access and re-run — the ` +
      `policy file needs no edit.`,
  };
}
