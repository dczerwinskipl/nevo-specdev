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
  highestPrereleaseTag,
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
 * @returns {{ errors: string[], tag?: string, channel?: 'beta'|'rc'|'stable',
 *   prerelease?: boolean, version?: string,
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
      channel,
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
  return errors.length ? { errors } : { errors, tag, channel, prerelease: true, version };
}

/**
 * Choose which tag `executeRelease` acts on. Normally the planned next number —
 * but if the highest prerelease tag that already exists for this version+channel
 * is sitting on the release-branch HEAD *without* its GitHub Release, that tag is
 * an unfinished previous run: target it and complete the Release rather than
 * skipping ahead to N+1. Pure — the tag/Release state is passed in.
 *
 * @param {object} o
 * @param {string} o.plannedTag
 * @param {boolean} o.prerelease
 * @param {string | null} o.highestTag
 * @param {{ state: 'absent'|'ok'|'mismatch', release: boolean } | null} o.highestTagState
 * @returns {{ tag: string, recovering: boolean }}
 */
export function pickReleaseCandidate({ plannedTag, prerelease, highestTag, highestTagState }) {
  if (
    prerelease &&
    highestTag &&
    highestTagState &&
    highestTagState.state === 'ok' &&
    !highestTagState.release
  ) {
    return { tag: highestTag, recovering: true };
  }
  return { tag: plannedTag, recovering: false };
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
 * Keep only the newest run per check name. After a re-run GitHub returns both
 * the old and the new run for a name; the newest `id` is the current one. Pure.
 *
 * @param {Array<{ name?: unknown, status?: unknown, conclusion?: unknown, id?: unknown }>} runs
 * @returns {Map<string, { name: string, status: string, conclusion: string | null, id: number }>}
 */
export function latestCheckRunsByName(runs) {
  /** @type {Map<string, { name: string, status: string, conclusion: string | null, id: number }>} */
  const byName = new Map();
  for (const r of Array.isArray(runs) ? runs : []) {
    if (!r || typeof r.name !== 'string') continue;
    const run = {
      name: r.name,
      status: String(r.status ?? ''),
      conclusion: r.conclusion == null ? null : String(r.conclusion),
      id: Number(r.id ?? 0),
    };
    const prev = byName.get(run.name);
    if (!prev || run.id >= prev.id) byName.set(run.name, run);
  }
  return byName;
}

/**
 * Which required checks are missing / not green, given the latest run per name. Pure.
 *
 * @param {Map<string, { status: string, conclusion: string | null }>} byName
 * @param {readonly string[]} required
 * @returns {{ missing: string[], notPassing: string[] }}
 */
export function evaluateRequiredChecks(byName, required) {
  /** @type {string[]} */ const missing = [];
  /** @type {string[]} */ const notPassing = [];
  for (const name of required) {
    const run = byName.get(name);
    if (!run) missing.push(name);
    else if (run.status !== 'completed' || run.conclusion !== 'success') {
      notPassing.push(`${name} (${run.status || 'unknown'}/${run.conclusion ?? 'pending'})`);
    }
  }
  return { missing, notPassing };
}

/**
 * Verify the required checks on `sha` are all `success` on GitHub. Throws with a
 * clear message otherwise — a release is never cut from an unvalidated commit.
 *
 * @param {string} sha
 */
export function verifyHeadChecksPassed(sha) {
  // `--slurp` wraps every page in ONE outer array, so the output is a single
  // JSON document (not N concatenated arrays that JSON.parse would choke on).
  // `per_page=100` keeps a busy commit to a page or two.
  const raw = gh([
    'api',
    `repos/{owner}/{repo}/commits/${sha}/check-runs?per_page=100`,
    '--paginate',
    '--slurp',
    '--jq',
    '[.[].check_runs[] | { name, status, conclusion, id }]',
  ]);
  /** @type {unknown} */
  let runs;
  try {
    runs = JSON.parse(raw || '[]');
  } catch (err) {
    throw new Error(
      `Could not read check-run status for ${sha.slice(0, 7)} from GitHub: ` +
        `${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }

  const byName = latestCheckRunsByName(/** @type {any[]} */ (runs));
  const { missing, notPassing } = evaluateRequiredChecks(byName, REQUIRED_HEAD_CHECKS);
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
  const headShort = headSha.slice(0, 7);

  verifyHeadChecksPassed(headSha);

  const plannedTag = /** @type {string} */ (plan.tag);
  const prerelease = plan.prerelease === true;

  // Partial-run recovery: before accepting the planned next number, look at the
  // highest prerelease tag that already exists for this version+channel. If it is
  // on HEAD but never got its GitHub Release, finish THAT one.
  /** @type {string | null} */ let highestTag = null;
  /** @type {{ state: 'absent'|'ok'|'mismatch', release: boolean } | null} */
  let highestTagState = null;
  if (prerelease && plan.version && (plan.channel === 'beta' || plan.channel === 'rc')) {
    const existingTags = git(['tag', '--list']).split('\n').filter(Boolean);
    highestTag = highestPrereleaseTag({
      version: plan.version,
      channel: plan.channel,
      existingTags,
    });
    if (highestTag) highestTagState = inspectTagState(highestTag, headSha);
  }

  const { tag, recovering } = pickReleaseCandidate({
    plannedTag,
    prerelease,
    highestTag,
    highestTagState,
  });
  if (recovering && tag !== plannedTag) {
    log(
      `Recovering ${tag}: its tag is on ${headShort} but the GitHub Release is missing. ` +
        `Not cutting ${plannedTag}.`,
    );
  }

  const existing = inspectTagState(tag, headSha);
  const decision = decideReleaseAction(existing, { tag, headShort, branch });

  if ('error' in decision) throw new Error(decision.error);
  log(decision.message);
  if (decision.action === 'noop') return;

  if (decision.action === 'tag-and-release') {
    git(['tag', '-a', tag, '-m', tag, headSha]);
    git(['push', 'origin', `refs/tags/${tag}`]);
  }
  createGithubRelease(tag, prerelease, log);

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

  // Idempotent: a re-run after the tag succeeded but the advance PR step failed
  // must not try to recreate a branch/PR that is already open.
  const openAdvancePr = gh([
    'pr',
    'list',
    '--head',
    advanceBranch,
    '--base',
    branch,
    '--state',
    'open',
    '--json',
    'url',
    '--jq',
    '.[0].url // ""',
  ]);
  if (openAdvancePr) {
    log(`Branch-advance PR already open — nothing to do:\n  ${openAdvancePr}`);
    return;
  }

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
