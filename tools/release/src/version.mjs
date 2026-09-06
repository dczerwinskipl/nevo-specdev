// Version model for the release tooling. Pure functions; SemVer parsing/compare
// is delegated to the `semver` package — only Nevo SpecDev's channel/branch
// rules live here.
//
// `version.json` on every branch is `{ channel, version }` (version is a plain
// X.Y.Z):
//   main          -> { channel: "alpha",  version: <next dev X.Y.0> }
//   release/vX.Y   -> { channel: "beta"|"rc"|"stable", version: <X.Y.Z> }
//
// CI build version:
//   stable channel -> "<version>"                    (e.g. 1.3.0)
//   other channels -> "<version>-<channel>.<build>"  (e.g. 1.3.0-beta.147)
//
// Public tags are an intentional sequence (v1.3.0-beta.1, .2, ...) — see
// `nextPrereleaseTag`; the CI build number is never a public release number.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import semver from 'semver';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export const CHANNELS = Object.freeze(['alpha', 'beta', 'rc', 'stable']);
/** Channels that appear in a public tag's prerelease part. */
export const TAG_PRERELEASE_CHANNELS = Object.freeze(['beta', 'rc']);

/** @param {unknown} v @returns {v is string} true for a bare `X.Y.Z` (no prerelease/build) */
export function isCoreVersion(v) {
  return typeof v === 'string' && semver.valid(v) === v && !semver.prerelease(v);
}

/** `1.3.2` -> `release/v1.3` (throws on a non-core version). @param {string} version */
export function releaseBranchFor(version) {
  if (!isCoreVersion(version))
    throw new Error(`Not a plain SemVer version: ${JSON.stringify(version)}`);
  return `release/v${semver.major(version)}.${semver.minor(version)}`;
}

/** `release/v1.3` -> `"1.3"`; anything else -> null. @param {string} branch */
export function lineOfBranch(branch) {
  const m = /^release\/v(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(String(branch));
  return m ? `${m[1]}.${m[2]}` : null;
}

/** True if core `version` belongs to line `"X.Y"`. @param {string} version @param {string} line */
export function versionInLine(version, line) {
  return isCoreVersion(version) && `${semver.major(version)}.${semver.minor(version)}` === line;
}

/**
 * @typedef {{ channel: string, version: string }} VersionFile
 * @param {string} [root]
 * @returns {VersionFile}
 */
export function readVersionFile(root = REPO_ROOT) {
  let raw;
  try {
    raw = readFileSync(join(root, 'version.json'), 'utf8');
  } catch (err) {
    throw new Error(
      `Cannot read version.json: ${err instanceof Error ? err.message : String(err)}`,
      {
        cause: err,
      },
    );
  }
  return parseVersionFile(raw, 'version.json');
}

/** @param {string} raw @param {string} label @returns {VersionFile} */
export function parseVersionFile(raw, label = 'version.json') {
  let meta;
  try {
    meta = JSON.parse(raw);
  } catch (err) {
    throw new Error(`${label} is not valid JSON: ${err instanceof Error ? err.message : err}`, {
      cause: err,
    });
  }
  if (!CHANNELS.includes(meta.channel)) {
    throw new Error(`${label}: 'channel' must be one of ${CHANNELS.join(', ')}`);
  }
  if (!isCoreVersion(meta.version)) {
    throw new Error(`${label}: 'version' must be a plain SemVer version (X.Y.Z)`);
  }
  return { channel: meta.channel, version: meta.version };
}

/** JSON text for a version file (canonical form the tooling writes).
 * @param {{ channel: string, version: string }} o */
export function versionFileText({ channel, version }) {
  return `${JSON.stringify(
    {
      $comment:
        'The version this branch is working toward, and which channel it is in. CI derives its build version from this file plus the run number. See docs/development/releasing.md.',
      channel,
      version,
    },
    null,
    2,
  )}\n`;
}

/**
 * Derive the CI build version.
 *
 * A tag ref (`refs/tags/vX.Y.Z[-beta|rc.N]`) is the version itself — never
 * re-derived from version.json (that would stamp a release tag as an alpha).
 *
 * @param {object} o
 * @param {VersionFile} o.versionFile
 * @param {string} [o.ref]    git ref (GITHUB_REF)
 * @param {number|string} [o.build]   deterministic build number (GitHub run number)
 * @param {string} [o.sha]    short commit id for build metadata (optional)
 * @returns {string}
 */
export function deriveBuildVersion({ versionFile, ref = '', build = 0, sha = '' }) {
  if (ref.startsWith('refs/tags/')) {
    const v = ref.slice('refs/tags/'.length).replace(/^v/, '');
    if (!isReleaseTagVersion(v)) {
      throw new Error(
        `Tag ref '${ref}' is not a release version tag (vX.Y.Z or vX.Y.Z-beta|rc.N) — ` +
          `refusing to derive a build version for it.`,
      );
    }
    return v;
  }

  const { channel, version } = versionFile;
  if (channel === 'stable') return version;

  const buildNum = Number(build);
  if (!Number.isInteger(buildNum) || buildNum < 0) {
    throw new Error(`build must be a non-negative integer, got ${JSON.stringify(build)}`);
  }
  const base = `${version}-${channel}.${buildNum}`;
  return sha ? `${base}+${sha}` : base;
}

/** `1.3.0`, `1.3.0-beta.2`, `1.3.0-rc.10` — shapes a public release tag may take. @param {unknown} v */
export function isReleaseTagVersion(v) {
  if (isCoreVersion(v)) return true;
  const parsed = semver.parse(String(v));
  if (!parsed || parsed.prerelease.length !== 2) return false;
  const [id, n] = parsed.prerelease;
  return TAG_PRERELEASE_CHANNELS.includes(String(id)) && Number.isInteger(n) && Number(n) >= 1;
}

/**
 * Next intentional prerelease tag for a target version + channel, given the
 * tags that already exist.
 *
 *   version 1.3.0, channel beta, existing [v1.3.0-beta.1]  -> v1.3.0-beta.2
 *   version 1.3.0, channel rc,   existing [v1.3.0-beta.2]  -> v1.3.0-rc.1
 *
 * @param {object} o
 * @param {string} o.version   target X.Y.Z
 * @param {'beta'|'rc'} o.channel
 * @param {string[]} o.existingTags   tag names, with or without a leading `v`
 * @returns {string} tag name including the leading `v`
 */
export function nextPrereleaseTag({ version, channel, existingTags }) {
  const max = maxPrereleaseNumber({ version, channel, existingTags, caller: 'nextPrereleaseTag' });
  return `v${version}-${channel}.${max + 1}`;
}

/**
 * The **highest** intentional prerelease tag that already exists for this
 * version + channel, or `null` if none does. Used by the release flow to notice
 * an orphaned last tag (pushed, but its GitHub Release never created) before it
 * would otherwise skip ahead to the next number.
 *
 * @param {object} o
 * @param {string} o.version
 * @param {'beta'|'rc'} o.channel
 * @param {string[]} o.existingTags
 * @returns {string | null} tag name including the leading `v`
 */
export function highestPrereleaseTag({ version, channel, existingTags }) {
  const max = maxPrereleaseNumber({
    version,
    channel,
    existingTags,
    caller: 'highestPrereleaseTag',
  });
  return max === 0 ? null : `v${version}-${channel}.${max}`;
}

/**
 * @param {object} o
 * @param {string} o.version @param {'beta'|'rc'} o.channel
 * @param {string[]} o.existingTags @param {string} o.caller
 * @returns {number} the greatest N among `v<version>-<channel>.N` tags (0 if none)
 */
function maxPrereleaseNumber({ version, channel, existingTags, caller }) {
  if (!isCoreVersion(version)) throw new Error(`${caller}: bad version ${JSON.stringify(version)}`);
  if (!TAG_PRERELEASE_CHANNELS.includes(channel)) {
    throw new Error(`${caller}: channel must be 'beta' or 'rc', got ${JSON.stringify(channel)}`);
  }
  let max = 0;
  for (const t of existingTags ?? []) {
    const p = semver.parse(String(t).trim().replace(/^v/, ''));
    if (
      p &&
      p.version.startsWith(`${version}-`) &&
      semver.major(p) === semver.major(version) &&
      semver.minor(p) === semver.minor(version) &&
      semver.patch(p) === semver.patch(version) &&
      p.prerelease.length === 2 &&
      p.prerelease[0] === channel &&
      Number.isInteger(p.prerelease[1])
    ) {
      max = Math.max(max, Number(p.prerelease[1]));
    }
  }
  return max;
}

/**
 * Legal channel promotion on a release branch:
 *   beta -> rc                (same version)
 *   rc   -> stable            (same version)
 *   stable -> beta | rc       (starts the next patch: X.Y.Z -> X.Y.(Z+1))
 *
 * @param {object} o
 * @param {VersionFile} o.current
 * @param {string} o.toChannel
 * @returns {VersionFile}
 */
export function planPromotion({ current, toChannel }) {
  if (!CHANNELS.includes(toChannel)) throw new Error(`Unknown channel '${toChannel}'`);
  const { channel, version } = current;

  if (channel === 'beta' && toChannel === 'rc') return { channel: 'rc', version };
  if (channel === 'rc' && toChannel === 'stable') return { channel: 'stable', version };
  if (channel === 'stable' && (toChannel === 'beta' || toChannel === 'rc')) {
    return { channel: toChannel, version: semver.inc(version, 'patch') ?? version };
  }
  throw new Error(
    `Invalid promotion ${channel} -> ${toChannel}. Allowed: beta->rc, rc->stable, ` +
      `stable->beta|rc (starts the next patch).`,
  );
}

/**
 * Validate a `version.json` change from `from` to `to` as it will land on
 * `targetBranch`. Used by CI so an ordinary PR cannot hand-edit `version.json`
 * into an illegal state.
 *
 * `targetBranch` is the protected branch whose release state the change mutates
 * — the PR **base** branch, or the pushed branch, never the short-lived source
 * branch a PR happens to come from. A PR into `main` is validated as `main`; a
 * PR into `release/v1.3` is validated as `release/v1.3`.
 *
 * @param {object} o
 * @param {VersionFile} o.from          version.json on the target branch (the base)
 * @param {VersionFile} o.to            version.json the change would produce
 * @param {string} o.targetBranch       protected branch being mutated (`main`, `release/v1.3`)
 * @returns {{ ok: boolean, kind?: string, error?: string }}
 */
export function validateVersionTransition({ from, to, targetBranch }) {
  const sameFile = from.channel === to.channel && from.version === to.version;
  if (sameFile) return { ok: true, kind: 'unchanged' };

  const line = lineOfBranch(targetBranch);

  // main development-line bump: alpha stays alpha, version steps to the next
  // minor or major .0 and strictly increases.
  if (from.channel === 'alpha' && to.channel === 'alpha') {
    const bumpMinor = semver.inc(from.version, 'minor');
    const bumpMajor = semver.inc(from.version, 'major');
    if (to.version === bumpMinor || to.version === bumpMajor) {
      return { ok: true, kind: 'main-bump' };
    }
    return {
      ok: false,
      error: `main-line bump must go to ${bumpMinor} or ${bumpMajor}, got ${to.version}`,
    };
  }

  // Cutting a line: first commit on release/vX.Y takes main's version into beta.
  if (from.channel === 'alpha' && to.channel === 'beta' && from.version === to.version) {
    if (line && versionInLine(to.version, line)) return { ok: true, kind: 'line-cut' };
    return {
      ok: false,
      error: `release branch ${targetBranch} does not match version ${to.version}`,
    };
  }

  // Otherwise it must be a legal promotion on a release branch.
  if (!line) {
    return { ok: false, error: `unexpected version.json change on '${targetBranch}'` };
  }
  try {
    const expected = planPromotion({ current: from, toChannel: to.channel });
    if (expected.channel === to.channel && expected.version === to.version) {
      if (!versionInLine(to.version, line)) {
        return {
          ok: false,
          error: `${to.version} is not on line ${line} (branch ${targetBranch})`,
        };
      }
      return { ok: true, kind: 'promotion' };
    }
    return {
      ok: false,
      error:
        `promotion ${from.channel} ${from.version} -> ${to.channel} should yield ` +
        `${expected.channel} ${expected.version}, not ${to.channel} ${to.version}`,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Decide which protected branch's rules a `version.json` change must satisfy and
 * which git ref holds the "from" version.json to compare against. Pure — every
 * environment lookup and repo probe is injected, so the resolution itself is
 * unit-testable without a real checkout.
 *
 * Resolution order:
 *   1. `BASE_REF`            explicit override: that ref is both target and base.
 *   2. `GITHUB_BASE_REF`     a PR — the base branch is the state machine being
 *                            mutated; base version.json is `origin/<base>`.
 *   3. `GITHUB_REF` heads/*  a push — the pushed branch is the target; the prior
 *                            state is `HEAD~1` (a squash merge = the whole PR).
 *   4. local                 infer from the working-tree version.json channel:
 *                            `alpha` -> `main`; any release channel -> its
 *                            `release/vX.Y` (which must exist on `origin`).
 *
 * @param {object} o
 * @param {Record<string, string | undefined>} o.env   environment (a `process.env` slice)
 * @param {() => VersionFile} o.readWorkingVersion      parse the working-tree version.json
 * @param {(ref: string) => boolean} o.refExists        does this git ref resolve to a commit?
 * @returns {{ targetBranch: string, baseRef: string, source: string } | { error: string }}
 */
export function resolveTransitionTarget({ env, readWorkingVersion, refExists }) {
  if (env.BASE_REF) {
    return { targetBranch: env.BASE_REF, baseRef: env.BASE_REF, source: 'BASE_REF override' };
  }
  if (env.GITHUB_BASE_REF) {
    return {
      targetBranch: env.GITHUB_BASE_REF,
      baseRef: `origin/${env.GITHUB_BASE_REF}`,
      source: `pull_request base ${env.GITHUB_BASE_REF}`,
    };
  }
  if (env.GITHUB_REF && env.GITHUB_REF.startsWith('refs/heads/')) {
    const pushed = env.GITHUB_REF_NAME || env.GITHUB_REF.slice('refs/heads/'.length);
    return { targetBranch: pushed, baseRef: 'HEAD~1', source: `push to ${pushed}` };
  }

  /** @type {VersionFile} */ let vf;
  try {
    vf = readWorkingVersion();
  } catch (err) {
    return {
      error:
        `cannot read the working-tree version.json to infer the comparison target: ` +
        `${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const line = `${semver.major(vf.version)}.${semver.minor(vf.version)}`;
  if (vf.channel === 'alpha') {
    return {
      targetBranch: 'main',
      baseRef: 'origin/main',
      source: `local: alpha ${vf.version} -> main`,
    };
  }
  const releaseBranch = `release/v${line}`;
  if (refExists(`origin/${releaseBranch}`)) {
    return {
      targetBranch: releaseBranch,
      baseRef: `origin/${releaseBranch}`,
      source: `local: ${vf.channel} ${vf.version} -> ${releaseBranch}`,
    };
  }
  return {
    error:
      `version.json is on channel '${vf.channel}' (${vf.version}), which belongs to ` +
      `${releaseBranch}, but 'origin/${releaseBranch}' does not exist.\n` +
      `  - run 'git fetch origin' if the line was cut elsewhere, or\n` +
      `  - set BASE_REF explicitly (e.g. BASE_REF=origin/main) if you are preparing the line cut.`,
  };
}
