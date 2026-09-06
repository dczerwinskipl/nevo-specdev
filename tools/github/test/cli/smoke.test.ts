import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { beforeAll, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const bin = join(pkgRoot, 'dist', 'bin.js');

async function cli(args: string[]): Promise<{ code: number; stdout: string }> {
  try {
    const { stdout } = await execFileAsync('node', [bin, ...args], { cwd: pkgRoot });
    return { code: 0, stdout };
  } catch (err) {
    const e = err as { code?: number; stdout?: string };
    return { code: e.code ?? 1, stdout: e.stdout ?? '' };
  }
}

beforeAll(async () => {
  if (!existsSync(bin)) {
    await execFileAsync(
      'node',
      [join(pkgRoot, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.build.json'],
      { cwd: pkgRoot },
    ).catch(() => execFileAsync('tsc', ['-p', 'tsconfig.build.json'], { cwd: pkgRoot }));
  }
}, 60_000);

describe('nevo-repo-github CLI', () => {
  it('--help documents the configure subcommand and its --check flag', async () => {
    const { code, stdout } = await cli(['--help']);
    expect(code).toBe(0);
    expect(stdout).toContain('configure');
  });

  it('`configure --help` shows --check', async () => {
    const { code, stdout } = await cli(['configure', '--help']);
    expect(code).toBe(0);
    expect(stdout).toContain('--check');
  });

  it('an unknown command exits non-zero', async () => {
    expect((await cli(['frobnicate'])).code).not.toBe(0);
  });
});
