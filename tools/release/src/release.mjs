// Create a Git tag + GitHub Release for the current release branch's
// `{ channel, version }`. No npm publishing.
//
//   nevo-release --channel beta|rc|stable [--execute]
//
// Guards:
//   - run only on a `release/vX.Y` branch;
//   - the branch's version must belong to that line and match the requested channel;
//   - the branch HEAD must have PASSED CI (`quality`, `test`, `build`) — a release
//     is never cut from an unvalidated commit;
//   - if the target tag already exists it must point at the same HEAD, and the
//     step becomes "finish the missing GitHub Release" (idempotent recovery);
//   - after a `stable` tag, a follow-up PR advances the branch to the next
//     patch's `beta` state so future commits never keep reporting the shipped
//     `X.Y.Z`.

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isReleaseTagVersion,
  lineOfBranch,
  nextPrereleaseTag,
  planPromotion,
  versionFileText,
  versionInLine,
} from './version.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Checks that must be green on the release-branch HEAD before tagging. `pr-title` is PR-only. */
export const REQUIRED_HEAD_CHECKS = Object.freeze(['quality', 'test', 'build']);

/**
 * Decide which tag to create. Pure — no git, no network.
 *
 * @param {object} o
 * @param {string} o.branch          e.g. `release/v1.3`
 * @param {'beta'|'rc'|'stable'} o.channel
 * @param {{channel:string,version:string}} o.versionFile
 * @param {string[]} o.existingTags
 * @returns {{ errors: string[], tag?: string, prerelease?: boolean, version?: string,
 *   nextBranchState?: {channel:string,version:string} }}
 */
export function planRelease({ branch, channel, versionFile, existingTags }) {
  /** @type {string[]} */ const errors = [];
  const line = lineOfBranch(branch);
  if (!line) errors.push(`Releases must be cut from a release/vX.Y branch, not '${branch}'.`);
  if (!['beta', 'rc', 'stable'].includes(channel)) {
    errors.push(`--channel must be one of beta, rc, stable (got ${JSON.stringify(channel)}).`);
  }
  if (errors.length || !line) return { errors };

  if (!versionInLine(versionFile.version, line)) {
    errors.push(`version.json version ${versionFile.version} does not belong to line ${line}.`);
  }
  if (versionFile.channel !== channel) {
    errors.push(
      `Branch is in channel '${versionFile.channel}', not '${channel}'. Promote the branch ` +
        `first — merge a PR that sets version.json to this channel (see docs/development/releasing.md).`,
    );
  }
  if (errors.length) return { errors };

  const version = versionFile.version;
  const tags = (existingTags ?? []).map((t) => String(t).trim());

  if (channel === 'stable') {
    const tag = `v${version}`;
    return {
      errors,
      tag,
      prerelease: false,
      version,
      // After the stable tag, the branch moves on to the next patch's beta.
      nextBranchState: planPromotion({
        current: { channel: 'stable', version },
        toChannel: 'beta',
      }),
    };
  }

  const tag = nextPrereleaseTag({ version, channel, existingTags: tags });
  if (!isReleaseTagVersion(tag.replace(/^v/, ''))) {
    errors.push(`Computed tag ${tag} is not a valid release tag.`);
  }
  return errors.length ? { errors } : { errors, tag, prerelease: true, version };
}

// ── side effects ────────────────────────────────────────────────────────────

/** @param {string[]} args */
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

/**
 * Verify the required checks on `sha` are all `success` on GitHub. Throws with a
 * clear message otherwise — a release is never cut from an unvalidated commit.
 *
 * @param {string} sha
 */
export function verifyHeadChecksPassed(sha) {
  const raw = gh([
    'api',
    `repos/{owner}/{repo}/commits/${sha}/check-runs`,
    '--paginate',
    '--jq',
    '[.check_runs[] | {name, status, conclusion}]',
  ]);
  /** @type {Array<{name:string,status:string,conclusion:string|null}>} */
  const runs = JSON.parse(raw || '[]');
  const byName = new Map();
  for (const r of runs) {
    // keep the most recent (last) run per name
    byName.set(r.name, r);
  }
  const missing = [];
  const notPassing = [];
  for (const name of REQUIRED_HEAD_CHECKS) {
    const run = byName.get(name);
    if (!run) missing.push(name);
    else if (run.status !== 'completed' || run.conclusion !== 'success') {
      notPassing.push(`${name} (${run.status}/${run.conclusion ?? 'pending'})`);
    }
  }
  if (missing.length || notPassing.length) {
    throw new Error(
      `Release-branch HEAD ${sha.slice(0, 7)} has not passed CI.\n` +
        (missing.length ? `  missing: ${missing.join(', ')}\n` : '') +
        (notPassing.length ? `  not green: ${notPassing.join(', ')}\n` : '') +
        `Wait for the push CI on this commit to finish successfully, then re-run.`,
    );
  }
}

/**
 * @param {string} tag @param {string} headSha
 * @returns {{ state: 'absent'|'ok'|'mismatch', release: boolean }}
 */
export function inspectTagState(tag, headSha) {
  const tagSha = resolveTagSha(tag);
  const hasRelease = tagHasRelease(tag);
  if (!tagSha) return { state: 'absent', release: hasRelease };
  return { state: tagSha === headSha ? 'ok' : 'mismatch', release: hasRelease };
}

/** @param {string} tag @returns {string | null} */
function resolveTagSha(tag) {
  for (const args of [
    ['rev-list', '-n', '1', `refs/tags/${tag}`],
    ['rev-parse', `${tag}^{commit}`],
  ]) {
    try {
      return git(args);
    } catch {
      /* try the next form */
    }
  }
  return null;
}

/** @param {string} tag @returns {boolean} */
function tagHasRelease(tag) {
  try {
    gh(['release', 'view', tag, '--json', 'tagName', '--jq', '.tagName']);
    return true;
  } catch {
    return false;
  }
}

/**
 * Pure decision for a possibly-partial prior run. Given the tag/HEAD/Release
 * state, what should execute do?
 *
 * @param {{ state: 'absent'|'ok'|'mismatch', release: boolean }} existing
 * @param {{ tag: string, headShort: string, branch: string }} ctx
 * @returns {{ action: 'noop'|'create-release'|'tag-and-release', message: string } | { error: string }}
 */
export function decideReleaseAction(existing, { tag, headShort, branch }) {
  if (existing.state === 'mismatch') {
    return {
      error:
        `Tag ${tag} already exists but points at a different commit than ${branch} HEAD ` +
        `(${headShort}). Refusing to move or reuse it — investigate.`,
    };
  }
  if (existing.state === 'ok' && existing.release) {
    return {
      action: 'noop',
      message: `${tag} and its GitHub Release already exist and match HEAD — nothing to do.`,
    };
  }
  if (existing.state === 'ok') {
    return {
      action: 'create-release',
      message: `${tag} already exists and matches HEAD; creating the missing GitHub Release.`,
    };
  }
  return { action: 'tag-and-release', message: `Tagging ${tag} at ${headShort}` };
}

/**
 * @param {ReturnType<typeof planRelease>} plan
 * @param {{ hasToken: boolean, log: (m: string) => void }} opts
 */
export function executeRelease(plan, { hasToken, log }) {
  git(['fetch', 'origin', '--tags', '--prune']);
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  const headSha = git(['rev-parse', 'HEAD']);

  verifyHeadChecksPassed(headSha);

  const tag = /** @type {string} */ (plan.tag);
  const existing = inspectTagState(tag, headSha);
  const decision = decideReleaseAction(existing, { tag, headShort: headSha.slice(0, 7), branch });

  if ('error' in decision) throw new Error(decision.error);
  log(decision.message);
  if (decision.action === 'noop') return;

  if (decision.action === 'tag-and-release') {
    git(['tag', '-a', tag, '-m', tag, headSha]);
    git(['push', 'origin', `refs/tags/${tag}`]);
  }
  createGithubRelease(tag, plan.prerelease === true, log);

  if (plan.nextBranchState)
    advanceBranchAfterStable(branch, plan.nextBranchState, { hasToken, log });
}

/** @param {string} tag @param {boolean} prerelease @param {(m:string)=>void} log */
function createGithubRelease(tag, prerelease, log) {
  const args = ['release', 'create', tag, '--verify-tag', '--title', tag, '--generate-notes'];
  if (prerelease) args.push('--prerelease');
  const url = gh(args);
  log(`Published GitHub Release: ${url}`);
  log('(No npm package is published — out of scope.)');
}

/**
 * After a stable tag, open the PR that moves the release branch to the next
 * patch's beta state, so later commits never keep reporting the shipped version.
 *
 * @param {string} branch
 * @param {{channel:string,version:string}} nextState
 * @param {{ hasToken: boolean, log: (m:string)=>void }} opts
 */
function advanceBranchAfterStable(branch, nextState, { hasToken, log }) {
  const advanceBranch = `chore/advance-${branch.replace(/\//g, '-')}-to-${nextState.version}`;
  const startRef = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  try {
    git(['switch', '--create', advanceBranch, `origin/${branch}`]);
    writeFileSync(join(REPO_ROOT, 'version.json'), versionFileText(nextState));
    git(['add', 'version.json']);
    git(['commit', '-m', `chore(release): open ${nextState.version} stabilization (beta)`]);
    git(['push', 'origin', `HEAD:refs/heads/${advanceBranch}`]);

    const title = `chore(release): open ${nextState.version} stabilization (beta)`;
    const body =
      `The previous patch on \`${branch}\` shipped. Move the branch to ` +
      `\`{ channel: "beta", version: "${nextState.version}" }\` so its builds report ` +
      `\`${nextState.version}-beta.<n>\` instead of the already-released version.`;

    if (hasToken) {
      const url = gh([
        'pr',
        'create',
        '--base',
        branch,
        '--head',
        advanceBranch,
        '--title',
        title,
        '--body',
        body,
      ]);
      log(`Opened branch-advance PR: ${url}`);
      try {
        gh(['pr', 'merge', '--auto', '--squash', url]);
      } catch {
        /* auto-merge optional */
      }
    } else {
      log('');
      log(`No RELEASE_TOKEN — the branch-advance PR was NOT created. Run it yourself:`);
      log(
        `  gh pr create --base ${branch} --head ${advanceBranch} \\\n` +
          `    --title ${JSON.stringify(title)} --body ${JSON.stringify(body)}`,
      );
    }
  } finally {
    try {
      git(['checkout', '--force', startRef]);
    } catch {
      /* best effort */
    }
    try {
      git(['branch', '-D', advanceBranch]);
    } catch {
      /* best effort */
    }
  }
}
