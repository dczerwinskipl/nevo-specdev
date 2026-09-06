// Tiny synchronous git reads for the version-transition gate — a fast CI check
// where a couple of blocking `git` calls are simpler than threading async
// through the pure resolver.

import { execFileSync } from 'node:child_process';

export interface SyncGitReader {
  refExists(ref: string): boolean;
  readFileAtRef(ref: string, path: string): string | null;
}

export function createSyncGitReader(repoRoot: string): SyncGitReader {
  const tryGit = (args: readonly string[]): string | null => {
    try {
      return execFileSync('git', [...args], {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
    } catch {
      return null;
    }
  };

  return {
    refExists: (ref) => tryGit(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]) !== null,
    readFileAtRef: (ref, path) => tryGit(['show', `${ref}:${path}`]),
  };
}
