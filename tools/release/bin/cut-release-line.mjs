#!/usr/bin/env node
// Cut a maintained release line off the current origin/main.
//
//   nevo-cut-release-line --release-version 1.3.0 --next-development-version 1.4.0 [--execute]
//
// Inputs may also come from the environment (RELEASE_VERSION,
// NEXT_DEVELOPMENT_VERSION, EXECUTE) so the workflow never interpolates user
// input into a shell command. RELEASE_TOKEN (via GH_TOKEN) being present decides
// whether the main-bump PR is opened automatically or handed to a human.

import { parseArgs } from 'node:util';

import { planReleaseCut, executeReleaseCut } from '../src/cut-release-line.mjs';

const { values } = parseArgs({
  options: {
    'release-version': { type: 'string' },
    'next-development-version': { type: 'string' },
    execute: { type: 'boolean', default: false },
  },
});

const releaseVersion = values['release-version'] || process.env.RELEASE_VERSION || '';
const nextDevelopmentVersion =
  values['next-development-version'] || process.env.NEXT_DEVELOPMENT_VERSION || '';
const execute = values.execute || process.env.EXECUTE === 'true';
// The workflow sets RELEASE_TOKEN_PRESENT=true only when the secret is configured;
// locally, presence of RELEASE_TOKEN in the environment is enough.
const hasToken = process.env.RELEASE_TOKEN_PRESENT === 'true' || Boolean(process.env.RELEASE_TOKEN);

const out = (m) => process.stdout.write(`${m}\n`);

const plan = planReleaseCut({ releaseVersion, nextDevelopmentVersion });
if (plan.errors.length) {
  process.stderr.write(`Invalid inputs:\n  - ${plan.errors.join('\n  - ')}\n`);
  process.exit(1);
}

out('Plan');
out(`  release branch : ${plan.releaseBranch}  (from origin/main)`);
out(`  branch version : { channel: "beta", version: "${plan.releaseVersion}" }`);
out(
  `  main moves to  : { channel: "alpha", version: "${plan.nextVersion}" }  (${plan.step} step, PR ${plan.bumpBranch})`,
);

if (!execute) {
  out('\n--execute not set: validated only, nothing changed.');
  process.exit(0);
}

try {
  executeReleaseCut(plan, { hasToken, log: out });
} catch (err) {
  process.stderr.write(`\n${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}
