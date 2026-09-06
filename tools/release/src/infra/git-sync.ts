// Tiny synchronous git reads for the version-transition gate — a fast CI check
// where a couple of blocking `git` calls are simpler than threading async
// through the pure resolver.

import { execFileSync } from 'node:child_process';

export interface SyncGitReader {
  refExists(ref: string): boolean;
  /** File content at `<ref>:<path>`, or `null` ONLY when that path is absent from the tree. */
  readFileAtRef(ref: string, path: string): string | null;
}

class GitReadError extends Error {
  override readonly name = 'GitReadError';
}

export function createSyncGitReader(repoRoot: string): SyncGitReader {
  const git = (
    args: readonly string[],
  ): { ok: true; out: string } | { ok: false; stderr: string } => {
    try {
      return {
        ok: true,
        out: execFileSync('git', [...args], {
          cwd: repoRoot,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        }).trim(),
      };
    } catch (err) {
      const e = err as { stderr?: string | Buffer };
      return { ok: false, stderr: String(e.stderr ?? '') };
    }
  };

  return {
    refExists: (ref) => git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).ok,

    readFileAtRef: (ref, path) => {
      const r = git(['show', `${ref}:${path}`]);
      if (r.ok) return r.out;
      // A genuinely-absent path is the only "null" — anything else (a bad ref,
      // a broken object store) must surface, not be read as "no version.json".
      if (/does not exist in|exists on disk, but not in|Path '.*' does not exist/i.test(r.stderr)) {
        return null;
      }
      throw new GitReadError(
        `git show ${ref}:${path} failed: ${r.stderr.trim() || 'unknown error'}`,
      );
    },
  };
}
