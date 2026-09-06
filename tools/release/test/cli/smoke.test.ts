// Thin CLI smoke layer — invokes the real built executable in a subprocess.
// Not a re-test of Commander; just the wiring contracts.

import { execFile, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { beforeAll, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const bin = join(pkgRoot, 'dist', 'bin.js');

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

async function cli(args: string[], env: Record<string, string> = {}): Promise<RunResult> {
  try {
    const { stdout, stderr } = await execFileAsync('node', [bin, ...args], {
      cwd: pkgRoot,
      env: { ...process.env, ...env },
    });
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
      {
        cwd: pkgRoot,
      },
    ).catch(async () => {
      // fall back to a hoisted typescript
      await execFileAsync('tsc', ['-p', 'tsconfig.build.json'], { cwd: pkgRoot });
    });
  }
}, 60_000);

describe('nevo-release CLI', () => {
  it('--help lists every subcommand', async () => {
    const { code, stdout } = await cli(['--help']);
    expect(code).toBe(0);
    for (const cmd of ['version', 'check-transition', 'cut-line', 'create']) {
      expect(stdout).toContain(cmd);
    }
  });

  it('an unknown command exits non-zero', async () => {
    const { code } = await cli(['definitely-not-a-command']);
    expect(code).not.toBe(0);
  });

  it('create with an invalid channel exits non-zero', async () => {
    const { code } = await cli(['create', '--channel', 'ga']);
    expect(code).not.toBe(0);
  });

  it('cut-line validate-only really validates against the repo and makes no side effects', async () => {
    // Versions that do NOT match origin/main's version.json: validate-only must
    // FAIL for the same reason execute would (it is not a rubber stamp).
    const bad = await cli([
      'cut-line',
      '--release-version',
      '9.9.0',
      '--next-development-version',
      '9.10.0',
    ]);
    expect(bad.code).not.toBe(0);
    expect(bad.stderr + bad.stdout).toMatch(
      /has no version\.json|is developing|not in the expected state/,
    );

    // cut-line's side effect is creating branches — validate-only creates none.
    const branches = execFileSync('git', ['branch', '--list', 'chore/*', 'release/*'], {
      cwd: pkgRoot,
      encoding: 'utf8',
    });
    expect(branches.trim()).toBe('');
  });

  it('check-transition --json emits a single clean JSON object on stdout', async () => {
    const { code, stdout } = await cli(['check-transition', '--json']);
    expect(code).toBe(0);
    const parsed: unknown = JSON.parse(stdout.trim());
    expect(parsed).toHaveProperty('kind');
  });

  it('version prints the derived build version', async () => {
    const { code, stdout } = await cli(['version'], { GITHUB_RUN_NUMBER: '7' });
    expect(code).toBe(0);
    expect(stdout.trim()).toMatch(/^0\.1\.0-alpha\.7$/);
  });
});
