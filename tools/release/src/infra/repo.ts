// Filesystem access to the repository root and its `version.json`.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { parseVersionFile, type VersionFile } from '../domain/version.js';
import { UsageError } from '../errors.js';

/** Nearest ancestor of `start` that holds `pnpm-workspace.yaml`. */
export function findRepoRoot(start: string): string {
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
