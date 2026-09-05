#!/usr/bin/env node
// Cut a maintained release line: branch `release/vX.Y` off `main`, and move
// `main` to the explicitly chosen next development line.
//
//   node scripts/release/cut-release-line.mjs \
//     --release-version 0.1.0 --next-development-version 0.2.0 [--check] [--from <sha>]
//
// --check (default): validate inputs + plan, confirm the branch is free, write
//   nothing. --execute: create the release branch and open the main-bump PR.
//
// The next development version is a REQUIRED input — this tool never infers
// minor-vs-major. See docs/development/releasing.md.

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { isSemverCore, parseSemverCore, readVersionMeta, releaseBranchFor } from './version.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Pure planner. Returns the branch/line names plus any hard errors and soft
 * warnings — no I/O.
 *
 * @param {{ releaseVersion: string, nextDevelopmentVersion: string, currentLine?: string }} input
 */
export function planReleaseCut({ releaseVersion, nextDevelopmentVersion, currentLine }) {
  /** @type {string[]} */ const errors = [];
  /** @type {string[]} */ const warnings = [];

  for (const [label, v] of [
    ['--release-version', releaseVersion],
    ['--next-development-version', nextDevelopmentVersion],
  ]) {
    if (!isSemverCore(v))
      errors.push(`${label} must be a plain SemVer version (got ${JSON.stringify(v)})`);
  }
  if (errors.length) return { errors, warnings };

  const rel = parseSemverCore(releaseVersion);
  const next = parseSemverCore(nextDevelopmentVersion);

  const nextMinor = rel.major === next.major && next.minor === rel.minor + 1 && next.patch === 0;
  const nextMajor = next.major === rel.major + 1 && next.minor === 0 && next.patch === 0;
  if (!nextMinor && !nextMajor) {
    errors.push(
      `--next-development-version ${nextDevelopmentVersion} is neither the next minor ` +
        `(${rel.major}.${rel.minor + 1}.0) nor the next major (${rel.major + 1}.0.0) of ` +
        `${releaseVersion}. The next line must be an explicit, adjacent step.`,
    );
  }

  if (currentLine && currentLine !== releaseVersion) {
    warnings.push(
      `version.json#development.line is ${currentLine}, not ${releaseVersion}; the release ` +
        `branch is cut from main as-is and its recorded version is ${releaseVersion}.`,
    );
  }

  return {
    errors,
    warnings,
    releaseBranch: releaseBranchFor(releaseVersion),
    releaseVersion,
    nextLine: nextDevelopmentVersion,
    bumpBranch: `chore/bump-main-to-${nextDevelopmentVersion}-alpha`,
  };
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function git(args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}
function gh(args) {
  return execFileSync('gh', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}
function branchExistsOnOrigin(branch) {
  try {
    return git(['ls-remote', '--heads', 'origin', branch]).length > 0;
  } catch {
    return false;
  }
}

function isMain() {
  return fileURLToPath(import.meta.url) === process.argv[1];
}

if (isMain()) {
  const { values } = parseArgs({
    options: {
      'release-version': { type: 'string' },
      'next-development-version': { type: 'string' },
      from: { type: 'string' },
      execute: { type: 'boolean', default: false },
      check: { type: 'boolean', default: false },
    },
  });

  const out = (m) => process.stdout.write(`${m}\n`);
  const die = (m) => {
    process.stderr.write(`${m}\n`);
    process.exit(1);
  };

  const meta = readVersionMeta();
  const plan = planReleaseCut({
    releaseVersion: values['release-version'] ?? '',
    nextDevelopmentVersion: values['next-development-version'] ?? '',
    currentLine: meta.development.line,
  });

  if (plan.errors.length) die(`Invalid inputs:\n  - ${plan.errors.join('\n  - ')}`);
  plan.warnings.forEach((w) => process.stderr.write(`warning: ${w}\n`));

  const from = values.from || 'origin/main';
  out('Plan:');
  out(
    `  release branch : ${plan.releaseBranch}  (from ${from}, recorded version ${plan.releaseVersion})`,
  );
  out(
    `  main moves to  : ${plan.nextLine}-${meta.development.channel} (via PR on ${plan.bumpBranch})`,
  );

  if (branchExistsOnOrigin(plan.releaseBranch)) {
    die(`\n${plan.releaseBranch} already exists on origin — nothing to do.`);
  }
  out(`  ${plan.releaseBranch} does not exist on origin ✓`);

  const execute = values.execute && !values.check;
  if (!execute) {
    out('\n--check only: no changes made. Re-run with --execute (needs push rights, and a');
    out('token that lets the bump PR trigger CI — see docs/development/releasing.md).');
    process.exit(0);
  }

  // ── execute ──────────────────────────────────────────────────────────────
  git(['fetch', 'origin', '--prune']);
  const baseSha = git(['rev-parse', from]);

  git(['push', 'origin', `${baseSha}:refs/heads/${plan.releaseBranch}`]);
  out(`\nCreated ${plan.releaseBranch} at ${baseSha.slice(0, 7)}`);

  const nextMeta = {
    ...meta,
    development: { ...meta.development, line: plan.nextLine },
    releaseLines: [
      ...meta.releaseLines,
      { branch: plan.releaseBranch, version: plan.releaseVersion, status: 'maintained' },
    ],
  };
  git(['switch', '--create', plan.bumpBranch, from]);
  writeFileSync(join(REPO_ROOT, 'version.json'), `${JSON.stringify(nextMeta, null, 2)}\n`);
  git(['add', 'version.json']);
  git(['commit', '-m', `chore(release): begin ${plan.nextLine} development line`]);
  git(['push', '--set-upstream', 'origin', plan.bumpBranch]);

  const prUrl = gh([
    'pr',
    'create',
    '--base',
    'main',
    '--head',
    plan.bumpBranch,
    '--title',
    `chore(release): begin ${plan.nextLine} development line`,
    '--body',
    `Cut \`${plan.releaseBranch}\` from \`${from}\` (${baseSha.slice(0, 7)}).\n\n` +
      `This moves \`main\` onto the ${plan.nextLine} line. Merge once CI is green.`,
  ]);
  out(`\nOpened main-bump PR: ${prUrl}`);
  try {
    gh(['pr', 'merge', '--auto', '--squash', prUrl]);
    out('Requested auto-merge (lands when required checks pass).');
  } catch {
    out('Could not enable auto-merge — merge the PR manually once CI is green.');
  }
}
