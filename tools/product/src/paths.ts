// Repository layout the packaging tool needs. Kept in one place so `bundle`,
// `pack` and `dogfood` agree on where things are.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Nearest ancestor of `start` that holds `pnpm-workspace.yaml`. */
export function findRepoRoot(start: string): string {
  let dir = start;
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`could not find the repository root (no pnpm-workspace.yaml above ${start})`);
    }
    dir = parent;
  }
}

export interface RepoPaths {
  readonly root: string;
  /** the public product package. */
  readonly productPackage: string;
  /** ignored output directory for generated tarballs. */
  readonly artifactsDir: string;
  /** the built release-tool executable (reused for the canonical version). */
  readonly releaseBin: string;
}

export function repoPaths(root: string): RepoPaths {
  return {
    root,
    productPackage: join(root, 'packages', 'specdev'),
    artifactsDir: join(root, '.artifacts'),
    releaseBin: join(root, 'tools', 'release', 'dist', 'bin.js'),
  };
}

export function readJson<T = Record<string, unknown>>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}
