// Thin subprocess smoke of the built executable — wiring contracts only.

import { execFile, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { beforeAll, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const bin = join(pkgRoot, 'dist', 'bin.js');

async function cli(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync('node', [bin, ...args], { cwd: pkgRoot });
    return { code: 0, stdout, stderr };
  } catch (err) {
    const e = err as { code?: number; stdout?: string; stderr?: string };
    return { code: e.code ?? 1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

beforeAll(() => {
  // The fresh-state test in this same package deletes and rebuilds dist; rebuild
  // here too if we happen to run while it is gone, so file order does not matter.
  if (!existsSync(bin)) {
    execFileSync('pnpm', ['--filter', 'nevo-repo-product', 'build'], {
      cwd: join(pkgRoot, '..', '..'),
      stdio: 'ignore',
      shell: process.platform === 'win32',
    });
  }
});

describe('nevo-repo-product CLI', () => {
  it('--help lists bundle, pack and dogfood', async () => {
    const { code, stdout } = await cli(['--help']);
    expect(code).toBe(0);
    for (const cmd of ['bundle', 'pack', 'dogfood']) expect(stdout).toContain(cmd);
  });

  it('pack --help documents --json', async () => {
    const { code, stdout } = await cli(['pack', '--help']);
    expect(code).toBe(0);
    expect(stdout).toContain('--json');
  });

  it('an unknown subcommand exits non-zero', async () => {
    const { code } = await cli(['frobnicate']);
    expect(code).not.toBe(0);
  });
});
