// Filesystem access to the repository root and its `version.json`.

import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';

import { parseVersionFile, type VersionFile } from '../domain/version.js';
import { UsageError } from '../errors.js';

/**
 * Nearest ancestor of `start` that holds `pnpm-workspace.yaml`.
 *
 * `NEVO_RELEASE_REPO_ROOT` overrides the search outright: repository discovery
 * then resolves to that directory instead of the one the executable lives in,
 * and every later `git` / `gh` call runs there. It changes nothing else about
 * release behaviour. It exists so the CLI-smoke suite can point the real built
 * binary at a purpose-built temporary repository with a known `origin/main` —
 * it is not part of the tool's supported interface and must not be set in
 * normal use or in CI.
 */
export function findRepoRoot(start: string): string {
  const override = process.env.NEVO_RELEASE_REPO_ROOT?.trim();
  if (override) {
    if (!statSync(override, { throwIfNoEntry: false })?.isDirectory()) {
      throw new UsageError(`NEVO_RELEASE_REPO_ROOT is not a directory: ${override}`);
    }
    return override;
  }

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
