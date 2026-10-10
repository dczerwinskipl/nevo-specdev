// The real process boundary: build + pack the product with the repository-pinned
// pnpm, install THAT tarball into an isolated prefix outside the workspace, and
// run the installed `nevo-specflow` **through its generated executable shim**.
//
// Nothing here resolves through the repository's own node_modules — the prefix
// lives in the OS temp dir and is installed with `--ignore-workspace`, and the
// bundle itself has no dependencies to resolve. Every `pnpm` runs from the repo
// root (which carries `packageManager`) so Corepack never downloads "latest".

import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import crossSpawn from 'cross-spawn';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const pinnedPnpm = (
  JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as { packageManager: string }
).packageManager.replace(/^pnpm@/, '');

let tarball = '';
let version = '';
let prefix = '';
let binDir = '';
let runEnv: NodeJS.ProcessEnv = {};

beforeAll(() => {
  const prebuiltDir = process.env.NEVO_SPECFLOW_ARTIFACT_DIR;
  if (prebuiltDir) {
    const candidates = readdirSync(prebuiltDir)
      .filter((file) => file.endsWith('.tgz'))
      .map((file) => join(prebuiltDir, file));
    if (candidates.length !== 1 || !candidates[0]) {
      throw new Error(
        `Expected exactly one prebuilt .tgz in ${prebuiltDir}, found ${String(candidates.length)}.`,
      );
    }
    tarball = candidates[0];
  } else {
    // Local/default path: build the package before proving its installed boundary.
    const out = execFileSync(
      process.execPath,
      ['packages/specflow/packaging/bin.ts', 'pack', '--json'],
      {
        cwd: repoRoot,
        encoding: 'utf8',
      },
    );
    const parsed = JSON.parse(out.trim().split(/\r?\n/).filter(Boolean).pop() ?? '{}') as {
      tarball: string;
    };
    tarball = parsed.tarball;
  }

  prefix = mkdtempSync(join(tmpdir(), 'nevo-specflow-smoke-'));
  execFileSync('git', ['init', '-q'], { cwd: prefix });
  writeFileSync(
    join(prefix, 'package.json'),
    JSON.stringify({ name: 'nevo-specflow-smoke-host', version: '0.0.0', private: true }),
  );
  // pnpm run from repoRoot (pinned), directed at the prefix with --dir.
  const install = crossSpawn.sync('pnpm', ['--dir', prefix, '--ignore-workspace', 'add', tarball], {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (install.error || install.status !== 0) {
    throw install.error ?? new Error(install.stderr || install.stdout || 'pnpm install failed');
  }

  const manifestVersion = installedManifest().version;
  if (typeof manifestVersion !== 'string') {
    throw new Error('Installed artifact package.json has no string version.');
  }
  version = manifestVersion;

  binDir = join(prefix, 'node_modules', '.bin');
  runEnv = { ...process.env, PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}` };
}, 180_000);

afterAll(async () => {
  if (prefix) {
    if (process.platform === 'win32') {
      // Give Windows a moment to release executable/file handles after the child exits.
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    rmSync(prefix, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});

interface Run {
  code: number;
  stdout: string;
}
/** Invoke the installed `nevo-specflow` shim from the isolated prefix's .bin/PATH. */
function nevoSpec(args: string[], input?: string): Run {
  const result = crossSpawn.sync('nevo-specflow', args, {
    cwd: prefix,
    env: runEnv,
    encoding: 'utf8',
    input,
    windowsHide: true,
  });
  return {
    code: result.status ?? 1,
    stdout: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Could not allocate a test port.');
  }
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

function installedManifest(): Record<string, unknown> {
  return JSON.parse(
    readFileSync(join(prefix, 'node_modules', '@nevo', 'specflow', 'package.json'), 'utf8'),
  ) as Record<string, unknown>;
}

describe('packaged @nevo/specflow — isolated tarball install', () => {
  it('was packed with the repository-pinned pnpm', () => {
    const pnpm = crossSpawn.sync('pnpm', ['--version'], {
      cwd: repoRoot,
      encoding: 'utf8',
      windowsHide: true,
    });
    expect(pnpm.error).toBeFalsy();
    expect(pnpm.status).toBe(0);
    const v = (pnpm.stdout ?? '').trim();
    expect(v).toBe(pinnedPnpm);
    expect(pinnedPnpm.startsWith('10.')).toBe(true);
  });

  it('installs a minimal manifest without dependency or workspace leakage', () => {
    const pj = installedManifest();
    expect(pj.name).toBe('@nevo/specflow');
    expect(pj.version).toBe(version);
    expect((pj.bin as Record<string, string>)['nevo-specflow']).toBe('./dist/bin.js');
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

  it('ships the CLI and built SpecFlow UI, nothing outside the intended product surface', () => {
    const listing = tarArgs('-tzf').split(/\r?\n/).filter(Boolean).sort();
    expect(listing).toEqual(
      expect.arrayContaining([
        'package/LICENSE',
        'package/README.md',
        'package/THIRD_PARTY_NOTICES.txt',
        'package/dist/bin.js',
        'package/dist/ui/index.html',
        'package/package.json',
      ]),
    );
    expect(listing.some((path) => /^package\/dist\/ui\/assets\/.*\.js$/u.test(path))).toBe(true);
    expect(listing.some((path) => /^package\/dist\/ui\/assets\/.*\.css$/u.test(path))).toBe(true);
    expect(
      listing.every(
        (path) =>
          path === 'package/LICENSE' ||
          path === 'package/README.md' ||
          path === 'package/THIRD_PARTY_NOTICES.txt' ||
          path === 'package/package.json' ||
          path === 'package/dist/bin.js' ||
          path.startsWith('package/dist/ui/'),
      ),
    ).toBe(true);
  });

  it('THIRD_PARTY_NOTICES.txt carries licenses for third-party code embedded in the bundle', () => {
    const notices = tarArgs('-xzOf', 'package/THIRD_PARTY_NOTICES.txt');
    expect(notices).toMatch(/commander 15\.0\.0/);
    expect(notices).toMatch(/MIT License/i);
    expect(notices).toMatch(/Copyright \(c\) 2011 TJ Holowaychuk/);
    expect(notices).toMatch(/yaml 2\.9\.1 \(ISC\)/);
    expect(notices).toMatch(/Copyright Eemeli Aro <eemeli@gmail\.com>/);
    expect(notices).toMatch(/fastify 5\.12\.5/);
    expect(notices).toMatch(/openid-client 6\.8\.8/);
    expect(notices).toMatch(/@fastify\/rate-limit 11\.2\.0/);
    expect(notices).toMatch(/@clack\/prompts 1\.8\.1/);
    expect(notices).toMatch(/@clack\/core 1\.5\.1/);
    expect(notices).toMatch(/react 19\.3\.0/);
    expect(notices).toMatch(/react-dom 19\.3\.0/);
    expect(notices).toMatch(/@tanstack\/react-router 1\.170\.41/);
    // esbuild is build-only — its code is not in the bundle, so it is not listed.
    expect(notices).not.toMatch(/esbuild/i);
  });

  it('A. nevo-specflow --help — exit 0, names the CLI and the start command (via the shim)', () => {
    const r = nevoSpec(['--help']);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('nevo-specflow');
    expect(r.stdout).toContain('init');
    expect(r.stdout).toContain('start');
  });

  it('B. --version equals the packed package version via the installed shim', () => {
    const r = nevoSpec(['--version']);
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toBe(version);
  });

  it('C. nevo-specflow init --help — exposes project bootstrap (via the shim)', () => {
    const r = nevoSpec(['init', '--help']);
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/Initialize Nevo SpecFlow configuration/i);
  });

  it('D. start --help exposes the local product server via the installed shim', () => {
    const r = nevoSpec(['start', '--help']);
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/SpecFlow local server/i);
  });

  it('E. generates a password hash through the installed auth utility', () => {
    const r = nevoSpec(
      ['auth', 'hash-password', '--password-stdin'],
      'correct horse battery staple\n',
    );
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toMatch(/^\$scrypt\$16384\$8\$5\$/u);
  });

  it('F. starts the packaged Runtime, serves HTTP, and shuts down cleanly', async () => {
    const port = await freePort();
    mkdirSync(join(prefix, '.nevo'), { recursive: true });
    writeFileSync(
      join(prefix, '.nevo/config.yaml'),
      [
        'runtime:',
        '  server:',
        '    host: 127.0.0.1',
        `    port: ${port}`,
        '    tls:',
        '      enabled: false',
        '  authentication:',
        '    mode: none',
        '    providers:',
        '      password:',
        '        enabled: false',
        '      oidc:',
        '        instances: {}',
        '',
      ].join('\n'),
      'utf8',
    );

    const installedBin = join(prefix, 'node_modules', '@nevo', 'specflow', 'dist', 'bin.js');
    const child =
      process.platform === 'win32'
        ? spawn(process.execPath, [installedBin, 'start', '--demo'], {
            cwd: prefix,
            env: runEnv,
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
          })
        : crossSpawn('nevo-specflow', ['start', '--demo'], {
            cwd: prefix,
            env: runEnv,
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
          });
    const childStdout = child.stdout;
    const childStderr = child.stderr;
    if (!childStdout || !childStderr) {
      throw new Error('Runtime smoke requires piped stdout and stderr.');
    }
    childStdout.setEncoding('utf8');
    childStderr.setEncoding('utf8');

    let stdout = '';
    let stderr = '';
    childStdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    childStderr.on('data', (chunk: string) => {
      stderr += chunk;
    });

    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Packaged Runtime did not start. stdout=${stdout} stderr=${stderr}`));
        }, 10_000);

        const onData = () => {
          if (stdout.includes(`SpecFlow available at http://127.0.0.1:${port}`)) {
            clearTimeout(timeout);
            childStdout.off('data', onData);
            resolve();
          }
        };
        childStdout.on('data', onData);
        child.once('exit', (code, signal) => {
          clearTimeout(timeout);
          reject(
            new Error(
              `Runtime exited before startup: code=${String(code)} signal=${String(signal)} stderr=${stderr}`,
            ),
          );
        });
      });

      const root = await fetch(`http://127.0.0.1:${port}/`);
      expect(root.status).toBe(200);
      expect(root.headers.get('content-type')).toMatch(/text\/html/u);
      expect(await root.text()).toContain('<div id="root"></div>');

      const clientRoute = await fetch(`http://127.0.0.1:${port}/login`);
      expect(clientRoute.status).toBe(200);
      expect(await clientRoute.text()).toContain('<div id="root"></div>');

      const response = await fetch(`http://127.0.0.1:${port}/api/auth/session`);
      const specs = await fetch(`http://127.0.0.1:${port}/api/specs/overview?collection=current`);
      expect(specs.status).toBe(200);
      expect(specs.headers.get('cache-control')).toBe('no-store');
      expect(await specs.json()).toMatchObject({
        revision: 'backend-sample-current-1',
        collection: 'current',
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        authenticationRequired: false,
        authenticated: false,
        loginMethods: { password: { enabled: false }, oidc: [] },
      });

      child.kill('SIGTERM');
      const [code, signal] = (await once(child, 'exit')) as [number | null, NodeJS.Signals | null];
      if (process.platform === 'win32') {
        // Node cannot deliver POSIX-style SIGTERM to a child process on Windows;
        // child.kill() terminates it and reports the signal instead.
        expect(signal).toBe('SIGTERM');
        expect(code).toBeNull();
      } else {
        expect(signal).toBeNull();
        expect(code).toBe(0);
      }
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGTERM');
      }
    }
  }, 30_000);

  it('an unknown command still exits non-zero after install', () => {
    expect(nevoSpec(['definitely-not-a-command']).code).not.toBe(0);
  });

  it('the isolated prefix holds only @nevo/* — no repo packages leaked in', () => {
    const mods = readdirSync(join(prefix, 'node_modules')).filter((m) => !m.startsWith('.'));
    expect(mods).toEqual(['@nevo']);
  });
});
