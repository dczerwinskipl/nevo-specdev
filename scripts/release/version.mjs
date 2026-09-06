// Version derivation and validation for the release model. Pure functions are
// exported for tests; the CLI at the bottom wires in the environment.
//
// One schema, `version.json` = { channel, version }:
//   main            -> { channel: "alpha",  version: "<next dev X.Y.0>" }
//   release/vX.Y     -> { channel: "beta"|"rc"|"stable", version: "<X.Y.Z>" }
//
// CI build version:
//   stable channel  -> "<version>"                    (e.g. 1.3.0)
//   other channels  -> "<version>-<channel>.<build>"  (e.g. 1.3.0-beta.147)
//
// Public tags are a separate, intentional sequence (v1.3.0-beta.1, .2, ...) —
// see `nextPrereleaseTag`. The CI build number is never a public release number.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const CHANNELS = Object.freeze(['alpha', 'beta', 'rc', 'stable']);

const SEMVER_CORE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** @param {unknown} v @returns {v is string} true for a bare `X.Y.Z` */
export function isSemverCore(v) {
  return typeof v === 'string' && SEMVER_CORE.test(v);
}

/** `1.4.7` -> `{ major: 1, minor: 4, patch: 7 }` (throws on anything else) */
export function parseSemverCore(v) {
  const m = SEMVER_CORE.exec(String(v));
  if (!m) throw new Error(`Not a plain SemVer version: ${JSON.stringify(v)}`);
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/** Minor-line branch for a version: `1.3.2` -> `release/v1.3` */
export function releaseBranchFor(version) {
  const { major, minor } = parseSemverCore(version);
  return `release/v${major}.${minor}`;
}

/** `release/v1.3` -> `"1.3"`, or null if the branch is not a release line */
export function lineOfBranch(branch) {
  const m = /^release\/v(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(String(branch));
  return m ? `${m[1]}.${m[2]}` : null;
}

/** True if `version` (X.Y.Z) belongs to line `"X.Y"`. */
export function versionInLine(version, line) {
  const { major, minor } = parseSemverCore(version);
  return `${major}.${minor}` === line;
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
  let meta;
  try {
    meta = JSON.parse(raw);
  } catch (err) {
    throw new Error(`version.json is not valid JSON: ${err instanceof Error ? err.message : err}`, {
      cause: err,
    });
  }
  if (!CHANNELS.includes(meta.channel)) {
    throw new Error(`version.json: 'channel' must be one of ${CHANNELS.join(', ')}`);
  }
  if (!isSemverCore(meta.version)) {
    throw new Error("version.json: 'version' must be a plain SemVer version (X.Y.Z)");
  }
  return { channel: meta.channel, version: meta.version };
}

/**
 * Derive the CI build version.
 *
 * A tag ref (`refs/tags/vX.Y.Z[-...]`) is the version itself — it must never be
 * re-derived from version.json (that would stamp a release tag as an alpha).
 *
 * @param {object} o
 * @param {VersionFile} o.versionFile
 * @param {string} [o.ref]     git ref (GITHUB_REF)
 * @param {number|string} [o.build]  deterministic build number (GitHub run number)
 * @param {string} [o.sha]     short commit id for build metadata (optional)
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

/** `1.3.0`, `1.3.0-beta.2`, `1.3.0-rc.10` — the shapes a release tag may take. */
export function isReleaseTagVersion(v) {
  return (
    isSemverCore(v) ||
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-(beta|rc)\.([1-9]\d*)$/.test(String(v))
  );
}

/**
 * Compute the next intentional prerelease tag for a target version + channel,
 * given the tags that already exist.
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
  parseSemverCore(version);
  if (channel !== 'beta' && channel !== 'rc') {
    throw new Error(
      `nextPrereleaseTag: channel must be 'beta' or 'rc', got ${JSON.stringify(channel)}`,
    );
  }
  const re = new RegExp(`^v?${version.replace(/\./g, '\\.')}-${channel}\\.([1-9]\\d*)$`);
  let max = 0;
  for (const t of existingTags ?? []) {
    const m = re.exec(String(t).trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `v${version}-${channel}.${max + 1}`;
}

/**
 * Validate a channel promotion on a release branch. Returns the `{channel,
 * version}` the branch's version.json should hold afterwards.
 *
 * Allowed: beta->rc, rc->stable (same version); stable->{rc|beta} of the next
 * patch (X.Y.Z -> X.Y.(Z+1)). Anything else is rejected.
 *
 * @param {object} o
 * @param {VersionFile} o.current
 * @param {'beta'|'rc'|'stable'} o.toChannel
 * @returns {VersionFile}
 */
export function planPromotion({ current, toChannel }) {
  if (!CHANNELS.includes(toChannel)) {
    throw new Error(`Unknown channel '${toChannel}'`);
  }
  const { channel, version } = current;
  const same = (c) => ({ channel: c, version });

  if (channel === 'beta' && toChannel === 'rc') return same('rc');
  if (channel === 'rc' && toChannel === 'stable') return same('stable');
  if (channel === 'stable' && (toChannel === 'rc' || toChannel === 'beta')) {
    const { major, minor, patch } = parseSemverCore(version);
    return { channel: toChannel, version: `${major}.${minor}.${patch + 1}` };
  }
  throw new Error(
    `Invalid promotion ${channel} -> ${toChannel}. Allowed: beta->rc, rc->stable, ` +
      `stable->rc|beta (starts the next patch).`,
  );
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function isMain() {
  return process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
}

if (isMain()) {
  try {
    const versionFile = readVersionFile();
    const ref = process.env.GITHUB_REF ?? '';
    const build = process.env.GITHUB_RUN_NUMBER ?? '0';
    const rawSha = process.env.GITHUB_SHA ?? '';
    const sha = process.argv.includes('--with-sha') && rawSha ? rawSha.slice(0, 7) : '';
    process.stdout.write(`${deriveBuildVersion({ versionFile, ref, build, sha })}\n`);
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  }
}
