#!/usr/bin/env node
// CI + local gate (§13): a change to version.json must be a legal transition
// (unchanged / main-line bump / line cut / promotion). Compares the file at the
// appropriate base against the working tree.
//
// Base selection:
//   BASE_REF env               -> use it verbatim
//   GITHUB_BASE_REF (a PR)     -> origin/<base branch>
//   a branch push in CI        -> HEAD~1 (for a squash merge this is the whole PR)
//   local                      -> merge-base with origin/main, else HEAD~1

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { parseVersionFile, validateVersionTransition } from '../src/version.mjs';

const env = process.env;
const git = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const tryGit = (args) => {
  try {
    return git(args);
  } catch {
    return null;
  }
};

function resolveBase() {
  if (env.BASE_REF) return env.BASE_REF;
  if (env.GITHUB_BASE_REF) return `origin/${env.GITHUB_BASE_REF}`;
  if (env.GITHUB_REF && env.GITHUB_REF.startsWith('refs/heads/')) return 'HEAD~1';
  const mb = tryGit(['merge-base', 'HEAD', 'origin/main']);
  return mb || 'HEAD~1';
}

function resolveHeadBranch() {
  if (env.GITHUB_HEAD_REF) return env.GITHUB_HEAD_REF;
  if (env.GITHUB_REF_NAME) return env.GITHUB_REF_NAME;
  return tryGit(['rev-parse', '--abbrev-ref', 'HEAD']) || 'HEAD';
}

const base = resolveBase();
const headBranch = resolveHeadBranch();

const fromRaw = tryGit(['show', `${base}:version.json`]);
if (fromRaw === null) {
  process.stdout.write(`no version.json at ${base} — skipping transition check\n`);
  process.exit(0);
}

let from;
let to;
try {
  from = parseVersionFile(fromRaw, `${base}:version.json`);
  to = parseVersionFile(readFileSync('version.json', 'utf8'), 'version.json');
} catch (err) {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}

const result = validateVersionTransition({ from, to, branch: headBranch });
if (result.ok) {
  process.stdout.write(
    `version.json ${from.channel} ${from.version} -> ${to.channel} ${to.version} (${headBranch}): ${result.kind}\n`,
  );
  process.exit(0);
}
process.stderr.write(
  `Illegal version.json transition on '${headBranch}':\n` +
    `  ${from.channel} ${from.version} -> ${to.channel} ${to.version}\n` +
    `  ${result.error}\n` +
    `See docs/development/releasing.md for the legal transitions.\n`,
);
process.exit(1);
