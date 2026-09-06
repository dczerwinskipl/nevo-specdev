#!/usr/bin/env node
// Create a tag + GitHub Release for the current release branch.
//
//   nevo-release --channel beta|rc|stable [--execute]
//
// Run from a release/vX.Y branch. RELEASE_CHANNEL / EXECUTE env vars are
// accepted so the workflow passes no user input on the command line.

import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';

import { readVersionFile } from '../src/version.mjs';
import { planRelease, executeRelease } from '../src/release.mjs';

const { values } = parseArgs({
  options: { channel: { type: 'string' }, execute: { type: 'boolean', default: false } },
});
const channel = values.channel || process.env.RELEASE_CHANNEL || '';
const execute = values.execute || process.env.EXECUTE === 'true';
const hasToken = process.env.RELEASE_TOKEN_PRESENT === 'true' || Boolean(process.env.RELEASE_TOKEN);

const out = (m) => process.stdout.write(`${m}\n`);
const git = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

let branch;
let existingTags;
try {
  git(['fetch', 'origin', '--tags', '--prune']);
  branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  existingTags = git(['tag', '--list']).split('\n').filter(Boolean);
} catch (err) {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}

const plan = planRelease({ branch, channel, versionFile: readVersionFile(), existingTags });
if (plan.errors.length) {
  process.stderr.write(`Cannot release:\n  - ${plan.errors.join('\n  - ')}\n`);
  process.exit(1);
}

out('Plan');
out(`  branch  : ${branch}`);
out(`  channel : ${channel}`);
out(`  tag     : ${plan.tag}${plan.prerelease ? '  (prerelease)' : ''}`);
if (plan.nextBranchState) {
  out(
    `  then    : advance ${branch} -> { channel: "${plan.nextBranchState.channel}", version: "${plan.nextBranchState.version}" }`,
  );
}

if (!execute) {
  out('\n--execute not set: validated only, no tag created.');
  process.exit(0);
}

try {
  executeRelease(plan, { hasToken, log: out });
} catch (err) {
  process.stderr.write(`\n${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}
