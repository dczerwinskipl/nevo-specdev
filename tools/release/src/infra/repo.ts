// Filesystem access to the repository root and its `version.json`.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';

import { parseVersionFile, type VersionFile } from '../domain/version.js';
import { UsageError } from '../errors.js';

/**
 * Nearest ancestor of `start` that holds `pnpm-workspace.yaml`.
 *
 * `NEVO_RELEASE_REPO_ROOT` overrides the search outright: the CLI then runs
 * every `git` / `gh` operation against that directory instead of the repository
 * the executable happens to live in. It exists so the CLI-smoke suite can point
 * the real built binary at a purpose-built temporary repository with a known
 * `origin/main` — never set it in normal use or in CI.
 */
export function findRepoRoot(start: string): string {
  const override = process.env.NEVO_RELEASE_REPO_ROOT;
  if (override?.trim()) return override;

  let dir = start;
  for (;;) {
    try {
      readFileSync(join(dir, 'pnpm-workspace.yaml'));
      return dir;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) return start;
      dir = parent;
    }
  }
}

/** Read + parse `<repoRoot>/version.json`. Throws `UsageError`. */
export function readWorkingVersion(repoRoot: string): VersionFile {
  let raw: string;
  try {
    raw = readFileSync(join(repoRoot, 'version.json'), 'utf8');
  } catch (err) {
    throw new UsageError(
      `Cannot read version.json: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }
  return parseVersionFile(raw, 'version.json');
}
