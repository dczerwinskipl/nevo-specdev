// The real process boundary: build + pack the product, install THAT tarball into
// an isolated prefix outside the workspace, and run the installed `nevo-spec`.
//
// Nothing here resolves through the repository's own node_modules — the prefix
// lives in the OS temp dir and is installed with `--ignore-workspace`, and the
// bundle itself has no dependencies to resolve.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DASHBOARD_BOOTSTRAP_MARKER } from '@nevo/specdev-dashboard';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const sh = process.platform === 'win32';

let tarball = '';
let version = '';
let prefix = '';
let installedBin = '';

beforeAll(() => {
  const out = execFileSync('node', ['tools/product/dist/bin.js', 'pack', '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: sh,
  });
  const parsed = JSON.parse(out.trim().split(/\r?\n/).filter(Boolean).pop() ?? '{}') as {
    tarball: string;
    version: string;
  };
  tarball = parsed.tarball;
  version = parsed.version;

  prefix = mkdtempSync(join(tmpdir(), 'nevo-spec-smoke-'));
  writeFileSync(
    join(prefix, 'package.json'),
    JSON.stringify({ name: 'nevo-spec-smoke-host', version: '0.0.0', private: true }),
  );
  execFileSync('pnpm', ['add', tarball, '--ignore-workspace'], {
    cwd: prefix,
    encoding: 'utf8',
    shell: sh,
  });

  const pkgDir = join(prefix, 'node_modules', '@nevo', 'specdev');
  const rel = (
    JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')) as {
      bin: Record<string, string>;
    }
  ).bin['nevo-spec'];
  if (!rel) throw new Error('installed @nevo/specdev has no bin.nevo-spec');
  installedBin = join(pkgDir, rel);
}, 180_000);

afterAll(() => {
  if (prefix) rmSync(prefix, { recursive: true, force: true });
});

interface Run {
  code: number;
  stdout: string;
}
function nevoSpec(args: string[]): Run {
  try {
    return {
      code: 0,
      stdout: execFileSync('node', [installedBin, ...args], { cwd: prefix, encoding: 'utf8' }),
    };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? 1, stdout: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

describe('packaged @nevo/specdev — isolated tarball install', () => {
  it('the installed manifest carries the packed version and declares no runtime deps', () => {
    const pj = JSON.parse(
      readFileSync(join(prefix, 'node_modules', '@nevo', 'specdev', 'package.json'), 'utf8'),
    ) as { version: string; dependencies?: Record<string, string> };
    expect(pj.version).toBe(version);
    expect(pj.dependencies ?? {}).toEqual({});
  });

  it('A. nevo-spec --help — exit 0, names the CLI and the dashboard command', () => {
    const r = nevoSpec(['--help']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('nevo-spec');
    expect(r.stdout).toContain('dashboard');
  });

  it('B. nevo-spec --version — exit 0, equals the packed package version', () => {
    const r = nevoSpec(['--version']);
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toBe(version);
  });

  it('C. nevo-spec dashboard — exit 0, runs the sibling capability package', () => {
    const r = nevoSpec(['dashboard']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain(DASHBOARD_BOOTSTRAP_MARKER);
  });

  it('an unknown command still exits non-zero after install', () => {
    expect(nevoSpec(['definitely-not-a-command']).code).not.toBe(0);
  });

  it('the isolated prefix holds only @nevo/* — no repo packages leaked in', () => {
    const mods = readdirSync(join(prefix, 'node_modules')).filter((m) => !m.startsWith('.'));
    expect(mods).toEqual(['@nevo']);
  });
});
