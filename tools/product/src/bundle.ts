// The one canonical bundler for the product. esbuild compiles the `nevo-spec`
// entry and every INTERNAL workspace package it imports (currently
// `@nevo/specdev-dashboard`) — plus `commander` — into a single self-contained
// ESM file. That is why the packed tarball works with no registry and no
// workspace: there is nothing left to resolve at install time.
//
// A bundler is used HERE, and only here, for a concrete distribution reason
// (one installable product artifact containing internal workspace code). The
// repository's own tools are still plain `tsc`.

import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { build } from 'esbuild';

export interface BundleInput {
  /** absolute or cwd-relative entry (`src/bin.ts`). */
  readonly entry: string;
  /** absolute or cwd-relative output (`dist/bin.js`). */
  readonly outfile: string;
  /** value baked in for `NEVO_SPEC_VERSION_INJECTED`. */
  readonly version: string;
  readonly cwd?: string;
}

export async function bundleProduct(input: BundleInput): Promise<{ outfile: string }> {
  const cwd = input.cwd ?? process.cwd();
  const outfile = resolve(cwd, input.outfile);
  mkdirSync(dirname(outfile), { recursive: true });

  await build({
    absWorkingDir: cwd,
    entryPoints: [resolve(cwd, input.entry)],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    // Everything is compiled in — the artifact has zero runtime dependencies.
    packages: 'bundle',
    define: { NEVO_SPEC_VERSION_INJECTED: JSON.stringify(input.version) },
    banner: { js: '#!/usr/bin/env node' },
    legalComments: 'none',
    sourcemap: false,
    logLevel: 'silent',
  });

  return { outfile };
}
