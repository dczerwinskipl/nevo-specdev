// The real process boundary: build + pack the product with the repository-pinned
// pnpm, install THAT tarball into an isolated prefix outside the workspace, and
// run the installed `nevo-spec` **through its generated executable shim**.
//
// Nothing here resolves through the repository's own node_modules — the prefix
// lives in the OS temp dir and is installed with `--ignore-workspace`, and the
// bundle itself has no dependencies to resolve. Every `pnpm` runs from the repo
// root (which carries `packageManager`) so Corepack never downloads "latest".

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DASHBOARD_BOOTSTRAP_MARKER } from '@nevo/specdev-dashboard';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const sh = process.platform === 'win32';

const pinnedPnpm = (
  JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as { packageManager: string }
).packageManager.replace(/^pnpm@/, '');

let tarball = '';
let version = '';
let prefix = '';
let binDir = '';
let runEnv: NodeJS.ProcessEnv = {};

beforeAll(() => {
  // pack via the tool (already built by the nevo-repo-product#test turbo edge).
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
  // pnpm run from repoRoot (pinned), directed at the prefix with --dir.
  execFileSync('pnpm', ['--dir', prefix, '--ignore-workspace', 'add', tarball], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: sh,
  });

  binDir = join(prefix, 'node_modules', '.bin');
  runEnv = { ...process.env, PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}` };
}, 180_000);

afterAll(() => {
  if (prefix) rmSync(prefix, { recursive: true, force: true });
});

interface Run {
  code: number;
  stdout: string;
}
/** Invoke the installed `nevo-spec` shim from the isolated prefix's .bin, via PATH. */
function nevoSpec(args: string[]): Run {
  try {
    return {
      code: 0,
      stdout: execFileSync('nevo-spec', args, {
        cwd: prefix,
        env: runEnv,
        encoding: 'utf8',
        shell: sh,
      }),
    };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? 1, stdout: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

function installedManifest(): Record<string, unknown> {
  return JSON.parse(
    readFileSync(join(prefix, 'node_modules', '@nevo', 'specdev', 'package.json'), 'utf8'),
  ) as Record<string, unknown>;
}

describe('packaged @nevo/specdev — isolated tarball install', () => {
  it('was packed with the repository-pinned pnpm', () => {
    const v = execFileSync('pnpm', ['--version'], {
      cwd: repoRoot,
      encoding: 'utf8',
      shell: sh,
    }).trim();
    expect(v).toBe(pinnedPnpm);
    expect(pinnedPnpm.startsWith('10.')).toBe(true);
  });

  it('installs a manifest with the packed version, correct engines, no deps, no scripts, no workspace:', () => {
    const pj = installedManifest();
    expect(pj.name).toBe('@nevo/specdev');
    expect(pj.version).toBe(version);
    expect((pj.bin as Record<string, string>)['nevo-spec']).toBe('./dist/bin.js');
    expect((pj.engines as Record<string, string>).node).toBe('>=24.20.0 <25');
    expect(pj.dependencies ?? {}).toEqual({});
    expect(pj.devDependencies ?? {}).toEqual({});
    expect(pj.scripts ?? {}).toEqual({});
    expect(JSON.stringify(pj)).not.toContain('workspace:');
  });

  // `tar` from cwd + basename so the archive name has no drive-letter colon
  // (GNU tar would otherwise read `D:\…` as a remote host).
  const tarArgs = (flags: string, ...rest: string[]): string =>
    execFileSync('tar', [flags, basename(tarball), ...rest], {
      cwd: dirname(tarball),
      encoding: 'utf8',
    });

  it('ships exactly the intended files (incl. THIRD_PARTY_NOTICES.txt), nothing else', () => {
    const listing = tarArgs('-tzf').split(/\r?\n/).filter(Boolean).sort();
    expect(listing).toEqual([
      'package/LICENSE',
      'package/README.md',
      'package/THIRD_PARTY_NOTICES.txt',
      'package/dist/bin.js',
      'package/package.json',
    ]);
  });

  it('THIRD_PARTY_NOTICES.txt carries the Commander license that is embedded in the bundle', () => {
    const notices = tarArgs('-xzOf', 'package/THIRD_PARTY_NOTICES.txt');
    expect(notices).toMatch(/commander 15\.0\.0/);
    expect(notices).toMatch(/MIT License/i);
    expect(notices).toMatch(/Copyright \(c\) 2011 TJ Holowaychuk/);
    // esbuild is build-only — its code is not in the bundle, so it is not listed.
    expect(notices).not.toMatch(/esbuild/i);
  });

  it('A. nevo-spec --help — exit 0, names the CLI and the dashboard command (via the shim)', () => {
    const r = nevoSpec(['--help']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('nevo-spec');
    expect(r.stdout).toContain('dashboard');
  });

  it('B. nevo-spec --version — exit 0, equals the packed package version (via the shim)', () => {
    const r = nevoSpec(['--version']);
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toBe(version);
  });

  it('C. nevo-spec dashboard — exit 0, runs the dashboard capability (via the shim)', () => {
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
