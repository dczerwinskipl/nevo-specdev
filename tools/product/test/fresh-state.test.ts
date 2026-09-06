// Fresh-clone acceptance: after `pnpm install` alone — no prior `pnpm build` /
// `pnpm check` — the product commands must self-bootstrap. We simulate that by
// deleting the generated tool dist (and its incremental tsbuildinfo) and the
// artifacts dir, then running the real root script `pnpm product:pack`.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const sh = process.platform === 'win32';
const toolDir = join(repoRoot, 'tools', 'product');
const toolDist = join(toolDir, 'dist');
const toolTsBuild = join(toolDir, '.tsbuild');
const artifacts = join(repoRoot, '.artifacts');

const pinnedPnpm = (
  JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as { packageManager: string }
).packageManager.replace(/^pnpm@/, '');

function buildTool(): void {
  execFileSync('pnpm', ['--filter', 'nevo-repo-product', 'build'], {
    cwd: repoRoot,
    stdio: 'ignore',
    shell: sh,
  });
}

describe('pnpm product:pack — self-bootstrapping from a fresh install', () => {
  afterAll(() => {
    // leave the tool built for the rest of the suite / other packages
    if (!existsSync(join(toolDist, 'bin.js'))) buildTool();
  });

  it('the repository-pinned pnpm is what runs', () => {
    const v = execFileSync('pnpm', ['--version'], {
      cwd: repoRoot,
      encoding: 'utf8',
      shell: sh,
    }).trim();
    expect(v).toBe(pinnedPnpm);
    expect(pinnedPnpm.startsWith('10.')).toBe(true);
  });

  it('produces a tarball after tools/product/{dist,.tsbuild} and .artifacts contents are deleted', () => {
    const rm = (p: string): void =>
      rmSync(p, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    rm(toolDist);
    rm(toolTsBuild);
    mkdirSync(artifacts, { recursive: true });
    for (const f of readdirSync(artifacts)) rm(join(artifacts, f)); // clear, keep the dir (Windows EBUSY on rmdir)
    expect(existsSync(join(toolDist, 'bin.js'))).toBe(false);
    expect(readdirSync(artifacts)).toEqual([]);

    execFileSync('pnpm', ['product:pack'], {
      cwd: repoRoot,
      encoding: 'utf8',
      shell: sh,
      timeout: 180_000,
    });

    // the root script rebuilt the tool, then packed
    expect(existsSync(join(toolDist, 'bin.js'))).toBe(true);
    const tgz = readdirSync(artifacts).filter((f) => f.endsWith('.tgz'));
    expect(tgz.length).toBeGreaterThan(0);
  }, 200_000);
});
