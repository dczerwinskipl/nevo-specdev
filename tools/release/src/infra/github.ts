// The real `GitHubClient` — a thin adapter over the `gh` CLI.

import type { NormalizedCheckRun } from '../domain/release-plan.js';
import type { GitHubClient, PullRequestRef } from '../ports.js';
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
      const parsed: unknown = JSON.parse(raw.trim() || '[]');
      if (!Array.isArray(parsed)) return [];
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
        if (err instanceof CommandFailedError) return false;
        throw err;
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

    async enableAutoMerge(prUrl): Promise<void> {
      try {
        await gh(['pr', 'merge', '--auto', '--squash', prUrl]);
      } catch (err) {
        if (!(err instanceof CommandFailedError)) throw err;
        // auto-merge is best-effort — a repo without it configured is fine.
      }
    },
  };
}
