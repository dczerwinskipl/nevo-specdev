// The real `GitHubClient` — a thin adapter over the `gh` CLI.

import type { NormalizedCheckRun } from '../domain/release-plan.js';
import type { AutoMergeResult, GitHubClient, PullRequestRef } from '../ports.js';
import { CommandFailedError, run } from './exec.js';

export function createGitHubClient(repoRoot: string): GitHubClient {
  const opts = { cwd: repoRoot };
  const gh = (args: readonly string[]): Promise<string> => run('gh', args, opts);

  return {
    async checkRunsForCommit(sha): Promise<NormalizedCheckRun[]> {
      // `--slurp` collapses every page into ONE JSON document (not N concatenated
      // arrays); `per_page=100` keeps a busy commit to a page or two.
      const raw = await gh([
        'api',
        `repos/{owner}/{repo}/commits/${sha}/check-runs?per_page=100`,
        '--paginate',
        '--slurp',
        '--jq',
        '[.[].check_runs[] | { name, status, conclusion, id }]',
      ]);
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.trim() || '[]');
      } catch (err) {
        throw new Error(
          `could not parse check-run data for ${sha.slice(0, 12)} from GitHub: ${
            err instanceof Error ? err.message : String(err)
          }`,
          { cause: err },
        );
      }
      if (!Array.isArray(parsed)) {
        throw new Error(`unexpected check-run response shape for ${sha.slice(0, 12)}`);
      }
      return parsed.map((r): NormalizedCheckRun => {
        const o: Record<string, unknown> =
          typeof r === 'object' && r !== null ? (r as Record<string, unknown>) : {};
        return {
          name: typeof o.name === 'string' ? o.name : '',
          status: typeof o.status === 'string' ? o.status : '',
          conclusion: typeof o.conclusion === 'string' ? o.conclusion : null,
          id: typeof o.id === 'number' ? o.id : 0,
        };
      });
    },

    async releaseExists(tag): Promise<boolean> {
      try {
        await gh(['release', 'view', tag, '--json', 'tagName', '--jq', '.tagName']);
        return true;
      } catch (err) {
        // `gh release view` on a missing Release exits non-zero with a
        // recognisable "release not found" / 404. Anything else — auth, network,
        // rate limit, a malformed response — is "could not determine": re-throw
        // so the caller fails closed rather than proceeding as if it were absent.
        if (
          err instanceof CommandFailedError &&
          /release not found|HTTP 404|\bnot found\b/i.test(err.stderr)
        ) {
          return false;
        }
        throw new Error(
          `could not determine whether the GitHub Release '${tag}' exists: ${
            err instanceof Error ? err.message : String(err)
          }`,
          { cause: err },
        );
      }
    },

    async createRelease({ tag, prerelease }): Promise<{ url: string }> {
      const args = ['release', 'create', tag, '--verify-tag', '--title', tag, '--generate-notes'];
      if (prerelease) args.push('--prerelease');
      return { url: (await gh(args)).trim() };
    },

    async findOpenPullRequest({ head, base }): Promise<PullRequestRef | null> {
      const url = (
        await gh([
          'pr',
          'list',
          '--head',
          head,
          '--base',
          base,
          '--state',
          'open',
          '--json',
          'url',
          '--jq',
          '.[0].url // ""',
        ])
      ).trim();
      return url ? { url } : null;
    },

    async createPullRequest({ head, base, title, body }): Promise<PullRequestRef> {
      const url = (
        await gh(['pr', 'create', '--base', base, '--head', head, '--title', title, '--body', body])
      ).trim();
      return { url };
    },

    async enableAutoMerge(prUrl): Promise<AutoMergeResult> {
      try {
        await gh(['pr', 'merge', '--auto', '--squash', prUrl]);
        return { outcome: 'enabled' };
      } catch (err) {
        // The one expected non-fatal case: the repository does not allow
        // auto-merge. The PR is fine — it just waits for a normal merge.
        if (
          err instanceof CommandFailedError &&
          /auto[- ]?merge is not (allowed|enabled)|not have auto[- ]?merge|Auto merge is not allowed/i.test(
            err.stderr,
          )
        ) {
          return {
            outcome: 'unavailable',
            reason: 'the repository does not have auto-merge enabled',
          };
        }
        // auth / permission / network / anything else: fail closed.
        throw new Error(
          `could not request auto-merge for ${prUrl}: ${
            err instanceof Error ? err.message : String(err)
          }`,
          { cause: err },
        );
      }
    },
  };
}
