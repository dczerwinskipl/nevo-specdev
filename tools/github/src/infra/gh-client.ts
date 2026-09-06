// The real GitHubAdminClient — a thin synchronous adapter over the `gh` CLI.
// Short-lived admin use; blocking calls keep it simple.

import { execFileSync } from 'node:child_process';

import type { GitHubAdminClient, RulesetSummary } from '../ports.js';

function gh(args: readonly string[], input?: string): string {
  try {
    return execFileSync('gh', [...args], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      input,
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (err) {
    const e = err as { stderr?: string; stdout?: string };
    throw new Error(
      `gh ${args.join(' ')} failed:\n${(e.stderr ?? e.stdout ?? String(err)).trim()}`,
      {
        cause: err,
      },
    );
  }
}

function ghApi(
  path: string,
  { method = 'GET', body }: { method?: string; body?: unknown } = {},
): unknown {
  const args = ['api', '-H', 'Accept: application/vnd.github+json', '--method', method, path];
  if (body !== undefined) args.push('--input', '-');
  const out = gh(args, body === undefined ? undefined : JSON.stringify(body)).trim();
  return out ? (JSON.parse(out) as unknown) : undefined;
}

export function createGhClient(): GitHubAdminClient {
  return {
    requireAuth(): void {
      try {
        gh(['auth', 'status']);
      } catch (err) {
        throw new Error(
          `GitHub CLI is not authenticated. Run \`gh auth login\` (needs repo-admin rights).\n` +
            `${err instanceof Error ? err.message : String(err)}`,
          { cause: err },
        );
      }
    },

    detectRepo(): string {
      return gh(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']).trim();
    },

    getRepo: (repo) => ghApi(`repos/${repo}`) as Record<string, unknown>,

    patchRepo(repo, body): void {
      ghApi(`repos/${repo}`, { method: 'PATCH', body });
    },

    listCollaborators(repo) {
      const result = ghApi(`repos/${repo}/collaborators`);
      if (!Array.isArray(result)) {
        throw new Error('collaborators API did not return a list');
      }
      return result as { login: string; permissions?: Record<string, boolean> }[];
    },

    listRulesets: (repo) =>
      (ghApi(`repos/${repo}/rulesets?per_page=100`) ?? []) as RulesetSummary[],

    getRuleset: (repo, id) =>
      ghApi(`repos/${repo}/rulesets/${String(id)}`) as Record<string, unknown>,

    createRuleset: (repo, body) =>
      ghApi(`repos/${repo}/rulesets`, { method: 'POST', body }) as { id: number },

    updateRuleset(repo, id, body): void {
      ghApi(`repos/${repo}/rulesets/${String(id)}`, { method: 'PUT', body });
    },
  };
}
