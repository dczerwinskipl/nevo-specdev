#!/usr/bin/env node
// CI + local gate (§13): a change to version.json must be a legal transition for
// the protected branch it lands on — unchanged / main-line bump / line cut /
// promotion.
//
// The transition rules belong to the TARGET branch (the release state machine
// being mutated), never to the short-lived source branch a PR is pushed from.
// A PR into `main` is validated as `main`; a PR into `release/v1.3` is validated
// as `release/v1.3`, whatever the head branch is called.
//
// Target + base resolution (see resolveTransitionTarget):
//   BASE_REF env               -> explicit override (that ref is target + base)
//   GITHUB_BASE_REF (a PR)     -> target = base branch;  from = origin/<base>:version.json
//   a branch push in CI        -> target = pushed branch; from = HEAD~1:version.json
//   local                      -> target inferred from working-tree version.json:
//                                 alpha -> main; a release channel -> release/vX.Y

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import {
  parseVersionFile,
  resolveTransitionTarget,
  validateVersionTransition,
} from '../src/version.mjs';

const env = process.env;
/** @param {string[]} args */
const git = (args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
/** @param {string[]} args @returns {string | null} */
const tryGit = (args) => {
  try {
    return git(args);
  } catch {
    return null;
  }
};

const resolved = resolveTransitionTarget({
  env,
  readWorkingVersion: () => parseVersionFile(readFileSync('version.json', 'utf8'), 'version.json'),
  refExists: (ref) => tryGit(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]) !== null,
});

if ('error' in resolved) {
  process.stderr.write(`Cannot check the version.json transition: ${resolved.error}\n`);
  process.exit(1);
}

const { targetBranch, baseRef, source } = resolved;

const fromRaw = tryGit(['show', `${baseRef}:version.json`]);
if (fromRaw === null) {
  process.stdout.write(`no version.json at ${baseRef} (${source}) — skipping transition check\n`);
  process.exit(0);
}

let from;
let to;
try {
  from = parseVersionFile(fromRaw, `${baseRef}:version.json`);
  to = parseVersionFile(readFileSync('version.json', 'utf8'), 'version.json');
} catch (err) {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}

const result = validateVersionTransition({ from, to, targetBranch });
if (result.ok) {
  process.stdout.write(
    `version.json ${from.channel} ${from.version} -> ${to.channel} ${to.version} ` +
      `on ${targetBranch} (${source}): ${result.kind}\n`,
  );
  process.exit(0);
}
process.stderr.write(
  `Illegal version.json transition on '${targetBranch}' (${source}):\n` +
    `  ${from.channel} ${from.version} -> ${to.channel} ${to.version}\n` +
    `  ${result.error}\n` +
    `See docs/development/releasing.md for the legal transitions.\n`,
);
process.exit(1);
