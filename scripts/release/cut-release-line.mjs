#!/usr/bin/env node
// Cut a maintained release line: create `release/vX.Y` off `main` with its own
// version.json already set to `{ channel: "beta", version: <releaseVersion> }`,
// and open the PR that moves `main` onto the explicitly chosen next line.
//
//   node scripts/release/cut-release-line.mjs \
//     --release-version 1.3.0 --next-development-version 1.4.0 [--from <ref>] [--execute]
//
// Inputs may also come from the environment (RELEASE_VERSION,
// NEXT_DEVELOPMENT_VERSION, FROM_REF, EXECUTE) so the workflow never interpolates
// user input into a shell command.
//
// Without --execute this only validates and prints the plan. The next
// development version is REQUIRED — this tool never infers minor vs major.

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { isSemverCore, parseSemverCore, releaseBranchFor } from './version.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Pure planner — validates the two versions and derives the branch/line names.
 * No I/O.
 *
 * @param {{ releaseVersion: string, nextDevelopmentVersion: string }} input
 * @returns {{ errors: string[], releaseBranch?: string, releaseVersion?: string,
 *   nextVersion?: string, bumpBranch?: string, step?: 'minor'|'major' }}
 */
export function planReleaseCut({ releaseVersion, nextDevelopmentVersion }) {
  /** @type {string[]} */ const errors = [];

  for (const [label, v] of [
    ['--release-version', releaseVersion],
    ['--next-development-version', nextDevelopmentVersion],
  ]) {
    if (!isSemverCore(v))
      errors.push(`${label} must be a plain SemVer version (got ${JSON.stringify(v)})`);
  }
  if (errors.length) return { errors };

  const rel = parseSemverCore(releaseVersion);
  const next = parseSemverCore(nextDevelopmentVersion);

  const isNextMinor = rel.major === next.major && next.minor === rel.minor + 1 && next.patch === 0;
  const isNextMajor = next.major === rel.major + 1 && next.minor === 0 && next.patch === 0;
  if (!isNextMinor && !isNextMajor) {
    errors.push(
      `--next-development-version ${nextDevelopmentVersion} is neither the next minor ` +
        `(${rel.major}.${rel.minor + 1}.0) nor the next major (${rel.major + 1}.0.0) of ` +
        `${releaseVersion}. It must be an explicit, adjacent step.`,
    );
    return { errors };
  }

  return {
    errors,
    releaseBranch: releaseBranchFor(releaseVersion),
    releaseVersion,
    nextVersion: nextDevelopmentVersion,
    bumpBranch: `chore/bump-main-to-${nextDevelopmentVersion}`,
    step: isNextMajor ? 'major' : 'minor',
  };
}

// ── side effects ────────────────────────────────────────────────────────────

/** Run git, returning trimmed stdout. Throws (with stderr) on failure — fail closed. */
function git(args) {
  return execFileSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function gh(args) {
  return execFileSync('gh', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

/**
 * 'present' | 'absent'. Any failure to reach the remote throws rather than being
 * misread as "absent" — the original bug.
 */
function remoteBranchState(branch) {
  const out = git(['ls-remote', '--heads', 'origin', `refs/heads/${branch}`]);
  return out.length > 0 ? 'present' : 'absent';
}

/** URL of an open PR from `bumpBranch` into main, or null. */
function findOpenBumpPr(bumpBranch) {
  const json = gh([
    'pr',
    'list',
    '--head',
    bumpBranch,
    '--base',
    'main',
    '--state',
    'open',
    '--json',
    'url',
    '--jq',
    '.[0].url // ""',
  ]);
  return json || null;
}

function isMain() {
  return process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
}

if (isMain()) {
  const { values } = parseArgs({
    options: {
      'release-version': { type: 'string' },
      'next-development-version': { type: 'string' },
      from: { type: 'string' },
      execute: { type: 'boolean', default: false },
    },
  });

  const releaseVersion = values['release-version'] || process.env.RELEASE_VERSION || '';
  const nextDevelopmentVersion =
    values['next-development-version'] || process.env.NEXT_DEVELOPMENT_VERSION || '';
  const from = values.from || process.env.FROM_REF || 'origin/main';
  const execute = values.execute || process.env.EXECUTE === 'true';

  const out = (m) => process.stdout.write(`${m}\n`);
  const die = (m) => {
    process.stderr.write(`${m}\n`);
    process.exit(1);
  };

  const plan = planReleaseCut({ releaseVersion, nextDevelopmentVersion });
  if (plan.errors.length) die(`Invalid inputs:\n  - ${plan.errors.join('\n  - ')}`);

  out('Plan');
  out(`  release branch : ${plan.releaseBranch}  (from ${from})`);
  out(`  branch version : { channel: "beta", version: "${plan.releaseVersion}" }`);
  out(
    `  main moves to  : { channel: "alpha", version: "${plan.nextVersion}" }  (${plan.step} step, via PR ${plan.bumpBranch})`,
  );

  // Preconditions — fail closed if the remote can't be reached.
  git(['fetch', 'origin', '--prune', '--tags']);
  const branchState = remoteBranchState(plan.releaseBranch);
  const existingPr = findOpenBumpPr(plan.bumpBranch);

  if (branchState === 'present' && existingPr) {
    out(`\n${plan.releaseBranch} already exists and the main-bump PR is open:\n  ${existingPr}`);
    out('Nothing to do — merge that PR to finish.');
    process.exit(0);
  }
  if (branchState === 'present' && !existingPr) {
    die(
      `\n${plan.releaseBranch} already exists but there is no open main-bump PR.\n` +
        `The line was cut but main was never moved forward. Either open the bump PR by\n` +
        `hand (set version.json to {channel:"alpha",version:"${plan.nextVersion}"}), or —\n` +
        `with admin rights — delete ${plan.releaseBranch} and re-run this.`,
    );
  }
  out(`  ${plan.releaseBranch} does not exist on origin`);
  if (existingPr) {
    die(
      `\nAn open PR from ${plan.bumpBranch} already exists (${existingPr}) but the release\nbranch does not. Resolve that PR before cutting the line.`,
    );
  }

  if (!execute) {
    out('\n--execute not set: validated only, nothing changed.');
    process.exit(0);
  }

  // ── execute ──────────────────────────────────────────────────────────────
  const baseSha = git(['rev-parse', `${from}^{commit}`]);
  const work = `cut-release-${Date.now()}`;

  try {
    // 1. release/vX.Y = baseSha + one commit that sets the branch's version.json.
    git(['switch', '--create', work, baseSha]);
    writeVersionJson({ channel: 'beta', version: plan.releaseVersion });
    git(['add', 'version.json']);
    git(['commit', '-m', `chore(release): start ${plan.releaseVersion} stabilization (beta)`]);
    git(['push', 'origin', `HEAD:refs/heads/${plan.releaseBranch}`]);
    out(`\nCreated ${plan.releaseBranch} at ${baseSha.slice(0, 7)} + version.json`);

    // 2. main-bump PR.
    git(['switch', '--create', plan.bumpBranch, baseSha]);
    writeVersionJson({ channel: 'alpha', version: plan.nextVersion });
    git(['add', 'version.json']);
    git(['commit', '-m', `chore(release): begin ${plan.nextVersion} development line`]);
    git(['push', 'origin', `HEAD:refs/heads/${plan.bumpBranch}`]);

    const prUrl = gh([
      'pr',
      'create',
      '--base',
      'main',
      '--head',
      plan.bumpBranch,
      '--title',
      `chore(release): begin ${plan.nextVersion} development line`,
      '--body',
      `Cut \`${plan.releaseBranch}\` from \`${from}\` (\`${baseSha.slice(0, 7)}\`).\n\n` +
        `Moves \`main\` onto the \`${plan.nextVersion}\` \`alpha\` line. Safe to merge once CI is green.`,
    ]);
    out(`Opened main-bump PR: ${prUrl}`);
    try {
      gh(['pr', 'merge', '--auto', '--squash', prUrl]);
      out('Auto-merge requested — lands when required checks pass.');
    } catch {
      out('Auto-merge could not be enabled; merge the PR by hand once CI is green.');
    }
  } finally {
    try {
      git(['switch', '--force', '-']);
    } catch {
      /* best effort */
    }
    try {
      git(['branch', '-D', work]);
    } catch {
      /* best effort */
    }
  }
}

/** @param {{channel:string,version:string}} v */
function writeVersionJson(v) {
  const body = {
    $comment:
      'The version this branch is working toward, and which channel it is in. CI derives its build version from this file plus the run number. See docs/development/releasing.md.',
    channel: v.channel,
    version: v.version,
  };
  writeFileSync(join(REPO_ROOT, 'version.json'), `${JSON.stringify(body, null, 2)}\n`);
}
