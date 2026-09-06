// The real `GitHubClient` — a thin adapter over the `gh` CLI.

import type { NormalizedCheckRun } from '../domain/release-plan.js';
import type { AutoMergeResult, GitHubClient, PullRequestRef } from '../ports.js';
import { CommandFailedError, run } from './exec.js';

/**
 * `gh` authenticates from `GH_TOKEN` / `GITHUB_TOKEN`. The CI secret is named
 * `CI_GITHUB_RELEASE_TOKEN`; map it onto `GH_TOKEN` for the `gh` subprocesses so
 * a local operator only has to export the one variable. An explicitly-supplied
 * `GH_TOKEN` / `GITHUB_TOKEN` is never overridden (CI sets `GH_TOKEN` itself).
 */
export function resolveGhEnv(
  env: Readonly<Record<string, string | undefined>>,
): Record<string, string> | undefined {
  if (env.GH_TOKEN || env.GITHUB_TOKEN) return undefined;
  if (env.CI_GITHUB_RELEASE_TOKEN) return { GH_TOKEN: env.CI_GITHUB_RELEASE_TOKEN };
  return undefined;
}

/** First `HTTP/x.y NNN` status line in a `gh api --include` response, or `null`. */
export function httpStatus(raw: string): number | null {
  const m = /^HTTP\/[\d.]+\s+(\d{3})\b/im.exec(raw);
  return m?.[1] ? Number(m[1]) : null;
}

export type ReleaseLookup =
  | { readonly outcome: 'exists' }
  | { readonly outcome: 'absent' }
  | { readonly outcome: 'indeterminate'; readonly reason: string };

/**
 * Decide whether a Release exists purely from the HTTP status code of a
 * `gh api --include repos/.../releases/tags/<tag>` call — never from
 * human-readable CLI stderr. `200` -> exists, `404` -> confirmed absent,
 * anything else (401/403/429/5xx, or no status line at all because the call
 * never reached GitHub) -> indeterminate, and the caller must fail closed.
 */
export function classifyReleaseLookup(res: {
  readonly stdout: string;
  readonly exitCode: number | null;
}): ReleaseLookup {
  const status = httpStatus(res.stdout);
  if (status === 200) return { outcome: 'exists' };
  if (status === 404) return { outcome: 'absent' };
  return {
    outcome: 'indeterminate',
    reason:
      (status === null
        ? 'gh api returned no HTTP status line'
        : `gh api returned HTTP ${String(status)}`) + ` (exit ${String(res.exitCode)})`,
  };
}

export function createGitHubClient(
  repoRoot: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): GitHubClient {
  const ghEnv = resolveGhEnv(env);
  const opts = { cwd: repoRoot, ...(ghEnv ? { env: ghEnv } : {}) };
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
      // Query the Releases-by-tag REST endpoint and decide on the HTTP status
      // code from the wire (`--include` prints the status line), never on
      // human-readable CLI stderr:
      //   200 -> the Release exists
      //   404 -> confirmed absent
      //   anything else / no status line (auth, permission, rate limit,
      //   network, malformed) -> throw; the caller fails closed.
      const path = `repos/{owner}/{repo}/releases/tags/${tag}`;
      let res: { stdout: string; exitCode: number | null };
      try {
        res = { stdout: await gh(['api', '--include', '--silent', path]), exitCode: 0 };
      } catch (err) {
        if (err instanceof CommandFailedError) {
          res = { stdout: err.stdout, exitCode: err.exitCode };
        } else {
          throw err instanceof Error ? err : new Error(String(err));
        }
      }
      const lookup = classifyReleaseLookup(res);
      if (lookup.outcome === 'exists') return true;
      if (lookup.outcome === 'absent') return false;
      throw new Error(
        `could not determine whether the GitHub Release '${tag}' exists: ${lookup.reason}. ` +
          `Refusing to treat this as "the Release is absent".`,
      );
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
