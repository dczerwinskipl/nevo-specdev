// Cut a maintained release line: create `release/vX.Y` off the current
// `origin/main` with its own version.json set to `{ channel: "beta", version:
// <releaseVersion> }`, and open (or hand off) the PR that moves `main` onto the
// explicitly chosen next line.
//
// The line is always cut from the current `origin/main` — there is no historical
// "from" input. The next development version is REQUIRED; minor vs major is
// never inferred.

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import semver from 'semver';

import { isCoreVersion, parseVersionFile, releaseBranchFor, versionFileText } from './version.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/**
 * Pure planner — validates the two versions and derives branch/line names. No I/O.
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
    if (!isCoreVersion(v))
      errors.push(`${label} must be a plain SemVer version (got ${JSON.stringify(v)})`);
  }
  if (errors.length) return { errors };

  const isNextMinor = nextDevelopmentVersion === semver.inc(releaseVersion, 'minor');
  const isNextMajor = nextDevelopmentVersion === semver.inc(releaseVersion, 'major');
  if (!isNextMinor && !isNextMajor) {
    return {
      errors: [
        `--next-development-version ${nextDevelopmentVersion} is neither the next minor ` +
          `(${semver.inc(releaseVersion, 'minor')}) nor the next major ` +
          `(${semver.inc(releaseVersion, 'major')}) of ${releaseVersion}.`,
      ],
    };
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

/**
 * Validate `origin/main`'s OWN version.json (read at the fetched commit, never
 * the working tree) against the requested cut. `main` must be an `alpha`
 * development line whose version is exactly the one being stabilized, and the
 * next development version must be that version's next minor or major. Pure.
 *
 * @param {{ channel: string, version: string }} mainVersionFile
 * @param {{ releaseVersion: string, nextVersion: string }} o
 * @returns {string[]} errors (empty ⇒ ok)
 */
export function validateCutBaseVersion(mainVersionFile, { releaseVersion, nextVersion }) {
  /** @type {string[]} */ const errors = [];
  if (mainVersionFile.channel !== 'alpha') {
    errors.push(
      `origin/main version.json is channel '${mainVersionFile.channel}', not 'alpha' — ` +
        `main is not a development line.`,
    );
  }
  if (mainVersionFile.version !== releaseVersion) {
    errors.push(
      `origin/main is developing ${mainVersionFile.version}, but --release-version is ` +
        `${releaseVersion}. Cut the line for the version main is on, or bump main first.`,
    );
    return errors; // the next-version check below is only meaningful once these agree
  }
  const nextMinor = semver.inc(mainVersionFile.version, 'minor');
  const nextMajor = semver.inc(mainVersionFile.version, 'major');
  if (nextVersion !== nextMinor && nextVersion !== nextMajor) {
    errors.push(
      `--next-development-version ${nextVersion} is neither the next minor (${nextMinor}) ` +
        `nor the next major (${nextMajor}) of main's ${mainVersionFile.version}.`,
    );
  }
  return errors;
}

// ── side effects ────────────────────────────────────────────────────────────

/** git; throws (with stderr) on failure — fail closed. @param {string[]} args */
function git(args) {
  return execFileSync('git', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}
/** @param {string[]} args */
function gh(args) {
  return execFileSync('gh', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}
function currentRef() {
  try {
    return git(['symbolic-ref', '--quiet', '--short', 'HEAD']);
  } catch {
    return git(['rev-parse', 'HEAD']);
  }
}
/** 'present' | 'absent' — any failure to reach the remote throws. @param {string} branch */
function remoteBranchState(branch) {
  return git(['ls-remote', '--heads', 'origin', `refs/heads/${branch}`]).length > 0
    ? 'present'
    : 'absent';
}
/** @param {string} bumpBranch */
function openBumpPr(bumpBranch) {
  return (
    gh([
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
    ]) || null
  );
}

/**
 * Execute the cut. `hasToken` decides whether the workflow opens the main-bump
 * PR itself (a token that triggers `pull_request` workflows) or hands the exact
 * `gh pr create` command to a human.
 *
 * @param {ReturnType<typeof planReleaseCut>} plan
 * @param {{ hasToken: boolean, log: (m: string) => void }} opts
 */
export function executeReleaseCut(plan, { hasToken, log }) {
  const { releaseBranch, releaseVersion, nextVersion, bumpBranch } = plan;
  if (!releaseBranch || !releaseVersion || !nextVersion || !bumpBranch) {
    throw new Error('executeReleaseCut: called with an invalid plan (validate first).');
  }
  git(['fetch', 'origin', '--prune', '--tags']);

  const branchState = remoteBranchState(releaseBranch);
  const existingPr = openBumpPr(bumpBranch);
  if (branchState === 'present' && existingPr) {
    log(`${releaseBranch} already exists and the main-bump PR is open:\n  ${existingPr}`);
    log('Nothing to do — merge that PR to finish.');
    return;
  }
  if (branchState === 'present') {
    throw new Error(
      `${releaseBranch} already exists but no open main-bump PR was found.\n` +
        `The line was cut but main was never moved forward. Open the bump PR by hand\n` +
        `(set version.json to {channel:"alpha",version:"${nextVersion}"}) or, with\n` +
        `admin rights, delete ${releaseBranch} and re-run.`,
    );
  }
  if (existingPr) {
    throw new Error(
      `An open PR from ${bumpBranch} already exists (${existingPr}) but ${releaseBranch}\n` +
        `does not. Resolve that PR before cutting the line.`,
    );
  }

  const baseSha = git(['rev-parse', 'origin/main^{commit}']);

  // Validate origin/main's own version.json AT THAT COMMIT before any remote
  // mutation — never trust the working tree, and never cut a line from a main
  // that is not the alpha development line for `releaseVersion`.
  let mainVf;
  try {
    mainVf = parseVersionFile(
      git(['show', `${baseSha}:version.json`]),
      `origin/main@${baseSha.slice(0, 7)}:version.json`,
    );
  } catch (err) {
    throw new Error(
      `Cannot read/parse origin/main's version.json at ${baseSha.slice(0, 7)} — ` +
        `refusing to cut a release line from an unverified main.\n  ${
          err instanceof Error ? err.message : String(err)
        }`,
      { cause: err },
    );
  }
  const baseErrors = validateCutBaseVersion(mainVf, { releaseVersion, nextVersion });
  if (baseErrors.length) {
    throw new Error(
      `Refusing to cut ${releaseBranch} — origin/main is not in the expected state:\n  - ` +
        baseErrors.join('\n  - '),
    );
  }
  log(`origin/main at ${baseSha.slice(0, 7)} is alpha ${mainVf.version} — cut is consistent.`);

  const startRef = currentRef();
  const work = `cut-release-${Date.now()}`;

  try {
    // 1. release/vX.Y = origin/main + one commit setting its version.json.
    git(['switch', '--create', work, baseSha]);
    writeVersionFile({ channel: 'beta', version: releaseVersion });
    git(['add', 'version.json']);
    git(['commit', '-m', `chore(release): start ${releaseVersion} stabilization (beta)`]);
    git(['push', 'origin', `HEAD:refs/heads/${releaseBranch}`]);
    log(`Created ${releaseBranch} at ${baseSha.slice(0, 7)} + version.json`);

    // 2. chore/bump-main-to-<next> — ALWAYS based on the same current origin/main.
    git(['switch', '--create', bumpBranch, baseSha]);
    writeVersionFile({ channel: 'alpha', version: nextVersion });
    git(['add', 'version.json']);
    git(['commit', '-m', `chore(release): begin ${nextVersion} development line`]);
    git(['push', 'origin', `HEAD:refs/heads/${bumpBranch}`]);
    log(`Pushed ${bumpBranch} at ${baseSha.slice(0, 7)}`);

    const title = `chore(release): begin ${nextVersion} development line`;
    const body =
      `Cut \`${releaseBranch}\` from \`origin/main\` (\`${baseSha.slice(0, 7)}\`).\n\n` +
      `Moves \`main\` onto the \`${nextVersion}\` \`alpha\` line. Safe to merge once CI is green.`;

    if (hasToken) {
      const prUrl = gh([
        'pr',
        'create',
        '--base',
        'main',
        '--head',
        bumpBranch,
        '--title',
        title,
        '--body',
        body,
      ]);
      log(`Opened main-bump PR: ${prUrl}`);
      try {
        gh(['pr', 'merge', '--auto', '--squash', prUrl]);
        log('Auto-merge requested — lands when required checks pass.');
      } catch {
        log('Auto-merge could not be enabled; merge the PR by hand once CI is green.');
      }
    } else {
      log('');
      log('No RELEASE_TOKEN — the main-bump PR was NOT created (a PR opened by the');
      log('default token does not trigger CI, so its required checks never start).');
      log('Create it yourself so `pull_request` workflows run:');
      log('');
      log(
        `  gh pr create --base main --head ${bumpBranch} \\\n` +
          `    --title ${JSON.stringify(title)} \\\n` +
          `    --body ${JSON.stringify(body)}`,
      );
    }
  } finally {
    try {
      git(['checkout', '--force', startRef]);
    } catch {
      /* best effort */
    }
    for (const b of [work, bumpBranch]) {
      try {
        git(['branch', '-D', b]);
      } catch {
        /* best effort */
      }
    }
  }
}

/** @param {{channel:string,version:string}} v */
function writeVersionFile(v) {
  writeFileSync(join(REPO_ROOT, 'version.json'), versionFileText(v));
}
