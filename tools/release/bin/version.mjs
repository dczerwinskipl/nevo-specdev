#!/usr/bin/env node
// Print the CI build version for the current branch / ref.
//
//   nevo-version [--with-sha]

import { readVersionFile, deriveBuildVersion } from '../src/version.mjs';

try {
  const versionFile = readVersionFile();
  const ref = process.env.GITHUB_REF ?? '';
  const build = process.env.GITHUB_RUN_NUMBER ?? '0';
  const rawSha = process.env.GITHUB_SHA ?? '';
  const sha = process.argv.includes('--with-sha') && rawSha ? rawSha.slice(0, 7) : '';
  process.stdout.write(`${deriveBuildVersion({ versionFile, ref, build, sha })}\n`);
} catch (err) {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
}
