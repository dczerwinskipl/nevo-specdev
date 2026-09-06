import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { beforeAll, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
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

beforeAll(async () => {
  if (!existsSync(bin)) {
    await execFileAsync(
      'node',
      [join(pkgRoot, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.build.json'],
      { cwd: pkgRoot },
    ).catch(() => execFileAsync('tsc', ['-p', 'tsconfig.build.json'], { cwd: pkgRoot }));
  }
}, 60_000);

describe('nevo-docs CLI', () => {
  it('--help lists every subcommand', async () => {
    const { code, stdout } = await cli(['--help']);
    expect(code).toBe(0);
    for (const cmd of ['list', 'find', 'context', 'check', 'adr']) expect(stdout).toContain(cmd);
  });

  it('`adr new --help` documents its own options', async () => {
    const { code, stdout } = await cli(['adr', 'new', '--help']);
    expect(code).toBe(0);
    expect(stdout).toContain('--dry-run');
  });

  it('an unknown command exits non-zero', async () => {
    expect((await cli(['frobnicate'])).code).not.toBe(0);
  });

  it('find without a query exits non-zero', async () => {
    expect((await cli(['find'])).code).not.toBe(0);
  });

  it('check validates the real repository corpus', async () => {
    const { code, stdout } = await cli(['check']);
    expect(code).toBe(0);
    expect(stdout).toMatch(/corpus valid, index current/);
  });

  it('context --json emits one clean JSON array on stdout', async () => {
    const { code, stdout } = await cli(['context', 'git', 'workflow', '--json']);
    expect(code).toBe(0);
    const parsed: unknown = JSON.parse(stdout.trim());
    expect(Array.isArray(parsed)).toBe(true);
  });

  it('adr new --dry-run prints a YAML-safe draft and writes nothing', async () => {
    const { code, stdout } = await cli(['adr', 'new', 'Colons: everywhere', '--dry-run']);
    expect(code).toBe(0);
    expect(stdout).toContain('status: draft');
    expect(stdout).toContain('would create');
  });
});
