// The real `GitClient` — a thin adapter over the `git` CLI. No orchestration
// logic here; that lives in `app/`.

import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { GitClient } from '../ports.js';
import { CommandFailedError, run, runWithInput } from './exec.js';

export function createGitClient(repoRoot: string): GitClient {
  const opts = { cwd: repoRoot };
  const git = (args: readonly string[]): Promise<string> => run('git', args, opts);
  const gitLine = async (args: readonly string[]): Promise<string> => (await git(args)).trim();
  const tryGitLine = async (args: readonly string[]): Promise<string | null> => {
    try {
      return await gitLine(args);
    } catch (err) {
      if (err instanceof CommandFailedError) return null;
      throw err;
    }
  };

  return {
    async fetch(): Promise<void> {
      await git(['fetch', 'origin', '--prune', '--tags']);
    },

    currentBranch: () => gitLine(['rev-parse', '--abbrev-ref', 'HEAD']),
    headSha: () => gitLine(['rev-parse', 'HEAD']),

    resolveCommit: (ref) => tryGitLine(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]),

    async commitParents(ref): Promise<string[] | null> {
      // `rev-list --parents -n 1 X` -> "<commit> <parent1> [<parent2> ...]"
      const line = await tryGitLine(['rev-list', '--parents', '-n', '1', `${ref}^{commit}`]);
      if (line === null) return null;
      return line.split(/\s+/).filter(Boolean).slice(1);
    },

    async changedFiles(fromRef, toRef): Promise<string[]> {
      const out = await git(['diff', '--name-only', `${fromRef}`, `${toRef}`]);
      return out
        .split('\n')
        .map((f) => f.trim())
        .filter(Boolean);
    },

    async showFileAtRef(ref, path): Promise<string | null> {
      try {
        return await git(['show', `${ref}:${path}`]);
      } catch (err) {
        if (err instanceof CommandFailedError) return null;
        throw err;
      }
    },

    async listTags(): Promise<string[]> {
      const out = await git(['tag', '--list']);
      return out
        .split('\n')
        .map((t) => t.trim())
        .filter(Boolean);
    },

    tagCommit: (tag) => tryGitLine(['rev-list', '-n', '1', `refs/tags/${tag}`]),

    async createAnnotatedTag({ tag, sha, message }): Promise<void> {
      await git(['tag', '-a', tag, '-m', message, sha]);
    },

    async pushTag(tag): Promise<void> {
      await git(['push', 'origin', `refs/tags/${tag}`]);
    },

    async remoteBranchExists(branch): Promise<boolean> {
      const out = await git(['ls-remote', '--heads', 'origin', `refs/heads/${branch}`]);
      return out.trim().length > 0;
    },

    async commitSingleFileOnto({ baseRef, path, content, message }): Promise<string> {
      // Plumbing only — the working tree and HEAD are never touched.
      const blob = (
        await runWithInput('git', ['hash-object', '-w', '--stdin'], opts, content)
      ).trim();
      const dir = await mkdtemp(join(tmpdir(), 'nevo-release-'));
      const indexFile = join(dir, `index-${randomBytes(6).toString('hex')}`);
      const withIndex = { cwd: repoRoot, env: { GIT_INDEX_FILE: indexFile } };
      try {
        await run('git', ['read-tree', `${baseRef}^{tree}`], withIndex);
        await run(
          'git',
          ['update-index', '--add', '--cacheinfo', `100644,${blob},${path}`],
          withIndex,
        );
        const tree = (await run('git', ['write-tree'], withIndex)).trim();
        return (
          await git(['commit-tree', tree, '-p', `${baseRef}^{commit}`, '-m', message])
        ).trim();
      } finally {
        await rm(dir, { recursive: true, force: true }).catch(() => undefined);
      }
    },

    async pushCommitToBranch({ sha, branch }): Promise<void> {
      await git(['push', 'origin', `${sha}:refs/heads/${branch}`]);
    },
  };
}
