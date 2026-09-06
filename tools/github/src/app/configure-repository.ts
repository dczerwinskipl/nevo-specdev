// Reconcile GitHub merge settings + branch rulesets against repository-policy.json.
// Pure of I/O beyond the injected client; returns a structured result the CLI
// renders. Idempotent — rulesets are matched by name and updated in place.

import { diffPartial } from '../domain/diff-partial.js';
import {
  decidePrReviewPolicy,
  stripMeta,
  type PrReviewDecision,
  type RepositoryPolicy,
  type ReviewerDiscovery,
} from '../domain/policy.js';
import { desiredRuleset, normalizeRules } from '../domain/ruleset.js';
import type { GitHubAdminClient } from '../ports.js';

export interface ConfigureResult {
  readonly repo: string;
  readonly checkOnly: boolean;
  readonly review: PrReviewDecision;
  /** true when the review policy was unverifiable — nothing was applied/inspected. */
  readonly aborted: boolean;
  readonly changed: string[];
  readonly problems: string[];
  readonly log: string[];
}

function discoverEligibleReviewers(client: GitHubAdminClient, repo: string): ReviewerDiscovery {
  try {
    const eligible = client
      .listCollaborators(repo)
      .filter((c) => c.permissions?.push === true || c.permissions?.admin === true)
      .map((c) => c.login);
    return { ok: true, eligible };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

export function configureRepository(
  client: GitHubAdminClient,
  policy: RepositoryPolicy,
  { checkOnly }: { checkOnly: boolean },
): ConfigureResult {
  client.requireAuth();
  const repo = client.detectRepo();

  const changed: string[] = [];
  const problems: string[] = [];
  const log: string[] = [`${checkOnly ? 'Checking' : 'Configuring'} ${repo}`];

  const review = decidePrReviewPolicy({
    target: stripMeta(policy.pullRequest),
    discovery: discoverEligibleReviewers(client, repo),
  });

  if (review.kind === 'unverifiable') {
    return { repo, checkOnly, review, aborted: true, changed, problems, log };
  }
  const prParams = review.params;

  // ── merge settings ───────────────────────────────────────────────────────
  {
    const want = policy.merge;
    const diffs = diffPartial(want, client.getRepo(repo));
    if (diffs.length === 0) {
      log.push('merge settings: already correct');
    } else if (checkOnly) {
      problems.push(`merge settings drift:\n  ${diffs.join('\n  ')}`);
    } else {
      client.patchRepo(repo, want);
      changed.push(`merge settings: ${diffs.map((d) => d.split(':')[0]).join(', ')}`);
      const still = diffPartial(want, client.getRepo(repo));
      if (still.length)
        problems.push(`merge settings still wrong after PATCH:\n  ${still.join('\n  ')}`);
      else log.push('merge settings: updated');
    }
  }

  // ── rulesets ─────────────────────────────────────────────────────────────
  for (const spec of policy.rulesets) {
    const want = desiredRuleset(spec, policy, prParams);
    const compare = (rs: Record<string, unknown>): string[] =>
      diffPartial(
        { enforcement: want.enforcement, conditions: want.conditions, rules: want.rules },
        {
          enforcement: rs.enforcement,
          conditions: rs.conditions,
          rules: normalizeRules(rs.rules),
        },
      );

    const match = client.listRulesets(repo).find((r) => r.name === spec.name);
    if (match) {
      const diffs = compare(client.getRuleset(repo, match.id));
      if (diffs.length === 0) {
        log.push(`ruleset ${spec.name}: already correct (id ${String(match.id)})`);
        continue;
      }
      if (checkOnly) {
        problems.push(`ruleset ${spec.name} drift:\n  ${diffs.join('\n  ')}`);
        continue;
      }
      client.updateRuleset(repo, match.id, want);
      changed.push(`ruleset ${spec.name}: updated (id ${String(match.id)})`);
      const still = compare(client.getRuleset(repo, match.id));
      if (still.length)
        problems.push(
          `ruleset ${String(match.id)} still wrong after write:\n  ${still.join('\n  ')}`,
        );
      else log.push(`ruleset ${String(match.id)}: verified`);
    } else {
      if (checkOnly) {
        problems.push(`ruleset ${spec.name}: missing`);
        continue;
      }
      const created = client.createRuleset(repo, want);
      changed.push(`ruleset ${spec.name}: created (id ${String(created.id)})`);
      const still = compare(client.getRuleset(repo, created.id));
      if (still.length)
        problems.push(
          `ruleset ${String(created.id)} still wrong after write:\n  ${still.join('\n  ')}`,
        );
      else log.push(`ruleset ${String(created.id)}: verified`);
    }
  }

  return { repo, checkOnly, review, aborted: false, changed, problems, log };
}
