// `nevo-repo-product dogfood` — build + pack the REAL distributable, install
// THAT tarball globally with pnpm, and smoke the installed `nevo-spec`.
//
// It never uses `pnpm link`, never installs from `packages/specdev`, and never
// a `file:` path back into the repo — the whole point is to exercise the actual
// distribution boundary a user would hit: the pnpm-created global executable
// shim, resolved from PATH, on the repository-pinned pnpm.

import { delimiter } from 'node:path';

import { run, StepFailedError } from './exec.js';
import { findRepoRoot } from './paths.js';
import { packProduct, type PackResult } from './pack.js';
import { DASHBOARD_BOOTSTRAP_MARKER } from './markers.js';

export interface DogfoodResult extends PackResult {
  readonly globalBinDir: string;
  readonly checks: readonly string[];
}

export async function dogfoodInstall(
  opts: { env?: NodeJS.ProcessEnv; log?: (line: string) => void } = {},
): Promise<DogfoodResult> {
  const log = opts.log ?? (() => undefined);
  const repoRoot = findRepoRoot(process.cwd());

  const packed = await packProduct({ env: opts.env, log });

  // All pnpm calls run from the repo root so Corepack uses the pinned pnpm.
  log(`installing globally: pnpm add -g ${packed.tarball}`);
  run('pnpm', ['add', '-g', packed.tarball], { cwd: repoRoot, env: opts.env });

  const globalBinDir = run('pnpm', ['bin', '-g'], { cwd: repoRoot, env: opts.env });
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...opts.env,
    PATH: `${globalBinDir}${delimiter}${process.env.PATH ?? ''}`,
  };
  // Resolve `nevo-spec` from PATH and run it through the OS shim (cmd/ps1 on
  // Windows, the shell shim on Unix) — not `node <dist/bin.js>`.
  const nevoSpec = (args: string[]): string => run('nevo-spec', args, { env });

  const checks: string[] = [];

  const version = nevoSpec(['--version']);
  if (version !== packed.version) {
    throw new StepFailedError(
      `installed \`nevo-spec --version\` printed ${JSON.stringify(version)}, ` +
        `expected the packed version ${JSON.stringify(packed.version)}`,
    );
  }
  checks.push(`nevo-spec --version -> ${version}`);

  const help = nevoSpec(['--help']);
  for (const needle of ['nevo-spec', 'dashboard']) {
    if (!help.includes(needle)) {
      throw new StepFailedError(
        `\`nevo-spec --help\` is missing ${JSON.stringify(needle)}:\n${help}`,
      );
    }
  }
  checks.push('nevo-spec --help -> ok');

  const dashboard = nevoSpec(['dashboard']);
  if (!dashboard.includes(DASHBOARD_BOOTSTRAP_MARKER)) {
    throw new StepFailedError(
      `\`nevo-spec dashboard\` did not run the dashboard capability ` +
        `(expected ${JSON.stringify(DASHBOARD_BOOTSTRAP_MARKER)}):\n${dashboard}`,
    );
  }
  checks.push('nevo-spec dashboard -> dashboard capability ran');

  return { ...packed, globalBinDir, checks };
}
