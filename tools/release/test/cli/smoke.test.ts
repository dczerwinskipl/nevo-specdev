// Thin CLI smoke layer — invokes the real built executable in a subprocess.
// Not a re-test of Commander; just the wiring contracts.
//
// Determinism: no test here may depend on GitHub authentication, the live
// repository's open PRs, remote state beyond what the test constructs, or the
// network. The one scenario that exercises a real validation pass
// (`cut-line --validate-only`) runs against a purpose-built temporary git
// repository with its own bare `origin`, selected via `NEVO_RELEASE_REPO_ROOT`.

import { execFile, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const bin = join(pkgRoot, 'dist', 'bin.js');

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Run the built CLI. `env` is layered on top of `process.env`; a key set to
 *  `undefined` is removed from the child environment entirely. */
async function cli(
  args: string[],
  env: Record<string, string | undefined> = {},
): Promise<RunResult> {
  const childEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries({ ...process.env, ...env })) {
    if (v !== undefined) childEnv[k] = v;
  }
  try {
    const { stdout, stderr } = await execFileAsync('node', [bin, ...args], {
      cwd: pkgRoot,
      env: childEnv,
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

// ── An isolated repository the `cut-line` smoke scenario validates against ──
// A working clone + its own bare `origin`. `origin/main` carries a known
// `version.json` (`alpha 0.1.0`), so a cut for an unrelated version fails the
// SAME base-state check `--execute` would — with no reference to the real
// GitHub repository, its PRs, or any credential.
interface IsolatedRepo {
  root: string;
  cleanup: () => void;
}

function createIsolatedRepo(): IsolatedRepo {
  const scratch = mkdtempSync(join(tmpdir(), 'nevo-release-smoke-'));
  const remote = join(scratch, 'origin.git');
  const work = join(scratch, 'work');
  const git = (cwd: string, args: string[]): string =>
    execFileSync('git', args, { cwd, encoding: 'utf8' });

  mkdirSync(work, { recursive: true });
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', remote], { encoding: 'utf8' });

  git(work, ['init', '-q', '-b', 'main']);
  git(work, ['config', 'user.email', 'smoke@example.test']);
  git(work, ['config', 'user.name', 'Release Smoke']);
  git(work, ['config', 'commit.gpgsign', 'false']);
  // findRepoRoot's fallback also looks for this file; keep the fixture realistic.
  writeFileSync(join(work, 'pnpm-workspace.yaml'), 'packages: []\n');
  writeFileSync(join(work, 'version.json'), '{\n  "channel": "alpha",\n  "version": "0.1.0"\n}\n');
  git(work, ['add', '.']);
  git(work, ['commit', '-qm', 'chore: seed isolated release-smoke repo']);
  git(work, ['remote', 'add', 'origin', remote.replace(/\\/g, '/')]);
  git(work, ['push', '-q', '-u', 'origin', 'main']);

  return { root: work, cleanup: () => rmSync(scratch, { recursive: true, force: true }) };
}

let isolated: IsolatedRepo;
beforeAll(() => {
  isolated = createIsolatedRepo();
});
afterAll(() => isolated?.cleanup());

/** The `cut-line` validate-only scenario, run against the isolated repo. */
function cutLineValidateOnly(env: Record<string, string | undefined> = {}): Promise<RunResult> {
  return cli(['cut-line', '--release-version', '9.9.0', '--next-development-version', '9.10.0'], {
    NEVO_RELEASE_REPO_ROOT: isolated.root,
    ...env,
  });
}

/** Branch names present on the isolated repo's local work tree and its remote. */
function isolatedBranches(): { local: string[]; remote: string[] } {
  const local = execFileSync('git', ['branch', '--format=%(refname:short)'], {
    cwd: isolated.root,
    encoding: 'utf8',
  })
    .split('\n')
    .map((b) => b.trim())
    .filter(Boolean);
  const remote = execFileSync('git', ['ls-remote', '--heads', 'origin'], {
    cwd: isolated.root,
    encoding: 'utf8',
  })
    .split('\n')
    .map((l) => l.split('\t')[1] ?? '')
    .filter(Boolean);
  return { local, remote };
}

describe('nevo-release CLI', () => {
  it('--help lists every subcommand', async () => {
    const { code, stdout } = await cli(['--help']);
    expect(code).toBe(0);
    for (const cmd of ['version', 'check-transition', 'cut-line', 'promote', 'create']) {
      expect(stdout).toContain(cmd);
    }
  });

  it('promote --help documents --target', async () => {
    const { code, stdout } = await cli(['promote', '--help']);
    expect(code).toBe(0);
    expect(stdout).toContain('--target');
  });

  it('an unknown command exits non-zero', async () => {
    const { code } = await cli(['definitely-not-a-command']);
    expect(code).not.toBe(0);
  });

  it('create with an invalid channel exits non-zero', async () => {
    const { code } = await cli(['create', '--channel', 'ga']);
    expect(code).not.toBe(0);
  });

  it('promote with an invalid target exits non-zero', async () => {
    const { code } = await cli(['promote', '--target', 'ga']);
    expect(code).not.toBe(0);
  });

  it('cut-line validate-only really validates against the repo and makes no side effects', async () => {
    // Versions that do NOT match the isolated origin/main's version.json:
    // validate-only must FAIL for the same reason execute would (not a rubber
    // stamp) — it reaches the real base-version check.
    const bad = await cutLineValidateOnly();
    expect(bad.code).not.toBe(0);
    expect(bad.stderr + bad.stdout).toMatch(
      /has no version\.json|is developing|not in the expected state/,
    );

    // cut-line's side effect is creating branches — validate-only creates none,
    // locally or on the remote it would push to.
    const { local, remote } = isolatedBranches();
    expect(local).toEqual(['main']);
    expect(remote).toEqual(['refs/heads/main']);
  });

  it('the cut-line smoke needs no GitHub auth — GH_TOKEN / GITHUB_TOKEN absent, GITHUB_ACTIONS set', async () => {
    // Regression guard for the post-PR#1 failure: once origin/main carried a
    // real version.json the scenario reached GitHubClient.findOpenPullRequest
    // and `gh` demanded GH_TOKEN under Actions. The scenario must now complete
    // its validation entirely from local git state.
    const res = await cutLineValidateOnly({
      GH_TOKEN: undefined,
      GITHUB_TOKEN: undefined,
      GH_HOST: undefined,
      CI_GITHUB_RELEASE_TOKEN: undefined,
      GITHUB_ACTIONS: 'true',
      CI: 'true',
    });
    expect(res.code).not.toBe(0);
    expect(res.stderr + res.stdout).toMatch(/is developing|not in the expected state/);
    // The failure is the version-state check, NOT a missing-credential error.
    expect(res.stderr + res.stdout).not.toMatch(
      /GH_TOKEN|GITHUB_TOKEN environment variable|gh auth login|To use GitHub CLI/i,
    );
    expect(isolatedBranches().remote).toEqual(['refs/heads/main']);
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
