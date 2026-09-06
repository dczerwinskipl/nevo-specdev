// `nevo-repo-product pack` — the ONE canonical way to produce the installable
// Nevo SpecDev product artifact. Local dogfooding, and any future CI / release
// job, call this same function; there is no second pack implementation.
//
//   build the product graph (turbo, scoped — never a global pre-build)
//     -> resolve the canonical version from `nevo-release version`
//     -> esbuild the self-contained bundle into a scratch stage
//     -> write minimal package metadata (no deps, no scripts, real version)
//     -> `pnpm pack` -> deterministic `.artifacts/nevo-specdev-<version>.tgz`

import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import { bundleProduct } from './bundle.js';
import { run, StepFailedError } from './exec.js';
import { findRepoRoot, readJson, repoPaths, type RepoPaths } from './paths.js';
import { resolveProductVersion } from './version.js';

export interface PackResult {
  readonly name: string;
  readonly version: string;
  /** absolute path to the generated tarball under `.artifacts/`. */
  readonly tarball: string;
}

export interface PackOptions {
  /** skip the turbo graph build (the caller already built it). */
  readonly skipBuild?: boolean;
  /** version override (tests). */
  readonly version?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly log?: (line: string) => void;
}

interface SourceManifest {
  name: string;
  description?: string;
  license?: string;
  type?: string;
  bin?: Record<string, string>;
  files?: string[];
  engines?: Record<string, string>;
}

export async function packProduct(opts: PackOptions = {}): Promise<PackResult> {
  const log = opts.log ?? (() => undefined);
  const paths = repoPaths(findRepoRoot(process.cwd()));

  if (!opts.skipBuild) {
    // Scoped, turbo-free builds of exactly what pack consumes: the dashboard
    // capability (esbuild resolves its built dist) and the release tool (the
    // canonical version). `pnpm --filter` runs the package's own `tsc`, so this
    // is safe to nest inside `turbo run test` and never triggers a global build.
    log('building pack inputs (nevo-repo-release, @nevo/specdev-dashboard)…');
    run('pnpm', ['--filter', 'nevo-repo-release', 'build'], { cwd: paths.root, env: opts.env });
    run('pnpm', ['--filter', '@nevo/specdev-dashboard', 'build'], {
      cwd: paths.root,
      env: opts.env,
    });
  }

  const version = resolveProductVersion({
    repoRoot: paths.root,
    releaseBin: paths.releaseBin,
    override: opts.version,
    env: opts.env,
  });
  log(`product version: ${version}`);

  const stage = mkdtempSync(join(tmpdir(), 'nevo-specdev-pack-'));
  try {
    await bundleProduct({
      entry: 'src/bin.ts',
      outfile: join(stage, 'dist', 'bin.js'),
      version,
      cwd: paths.productPackage,
    });

    writeStageManifest(stage, paths, version);
    copyIfPresent(join(paths.productPackage, 'README.md'), join(stage, 'README.md'));
    copyIfPresent(join(paths.root, 'LICENSE'), join(stage, 'LICENSE'));

    mkdirSync(paths.artifactsDir, { recursive: true });
    const printed = run('pnpm', ['pack', '--pack-destination', paths.artifactsDir], { cwd: stage });
    const tarball = resolveTarball(paths.artifactsDir, printed, version);
    log(`packed: ${tarball}`);

    const manifest = readJson<SourceManifest>(join(paths.productPackage, 'package.json'));
    return { name: manifest.name, version, tarball };
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

function writeStageManifest(stage: string, paths: RepoPaths, version: string): void {
  const src = readJson<SourceManifest>(join(paths.productPackage, 'package.json'));
  // Deliberately minimal: the bundle has NO runtime dependencies, so the packed
  // manifest declares none, carries no scripts, and pins the real version.
  const out = {
    name: src.name,
    version,
    description: src.description,
    license: src.license,
    type: src.type ?? 'module',
    bin: src.bin,
    files: ['dist'],
    engines: src.engines,
  };
  writeFileSync(join(stage, 'package.json'), `${JSON.stringify(out, null, 2)}\n`);
}

function copyIfPresent(from: string, to: string): void {
  if (existsSync(from)) cpSync(from, to);
}

function resolveTarball(destDir: string, printed: string, version: string): string {
  const expected = join(destDir, `nevo-specdev-${version}.tgz`);
  if (existsSync(expected)) return expected;
  const named = printed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .pop();
  if (named) {
    const candidate = join(destDir, basename(named));
    if (existsSync(candidate)) return candidate;
  }
  throw new StepFailedError(
    `pnpm pack did not produce ${basename(expected)} in ${destDir} (pnpm said: ${printed || 'nothing'})`,
  );
}
