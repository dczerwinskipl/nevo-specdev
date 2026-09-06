// Version model for the release tooling. Pure — SemVer parsing/compare is the
// `semver` package; only Nevo SpecDev's channel/branch rules live here.
//
// `version.json` on every branch is `{ channel, version }` (version is a plain
// X.Y.Z):
//   main         -> { channel: "alpha", version: <next dev X.Y.0> }
//   release/vX.Y -> { channel: "beta"|"rc"|"stable", version: <X.Y.Z> }
//
// CI build version:
//   stable channel -> "<version>"                   (e.g. 1.3.0)
//   other channels -> "<version>-<channel>.<build>" (e.g. 1.3.0-beta.147)
//
// Public tags are an intentional sequence (v1.3.0-beta.1, .2, …) — never the CI
// build number.

import semver from 'semver';

import { UsageError } from '../errors.js';

export const CHANNELS = ['alpha', 'beta', 'rc', 'stable'] as const;
export type Channel = (typeof CHANNELS)[number];

/** Channels that appear in a public tag's prerelease part. */
export const TAG_PRERELEASE_CHANNELS = ['beta', 'rc'] as const;
export type PrereleaseChannel = (typeof TAG_PRERELEASE_CHANNELS)[number];

export interface VersionFile {
  readonly channel: Channel;
  /** A plain `X.Y.Z`. */
  readonly version: string;
}

export function isChannel(v: unknown): v is Channel {
  return typeof v === 'string' && (CHANNELS as readonly string[]).includes(v);
}

export function isPrereleaseChannel(v: unknown): v is PrereleaseChannel {
  return typeof v === 'string' && (TAG_PRERELEASE_CHANNELS as readonly string[]).includes(v);
}

/** True for a bare `X.Y.Z` (no prerelease / build metadata). */
export function isCoreVersion(v: unknown): v is string {
  return typeof v === 'string' && semver.valid(v) === v && semver.prerelease(v) === null;
}

/** `1.3.2` -> `release/v1.3` (throws on a non-core version). */
export function releaseBranchFor(version: string): string {
  if (!isCoreVersion(version)) {
    throw new UsageError(`Not a plain SemVer version: ${JSON.stringify(version)}`);
  }
  return `release/v${String(semver.major(version))}.${String(semver.minor(version))}`;
}

/** `release/v1.3` -> `"1.3"`; anything else -> `null`. */
export function lineOfBranch(branch: string): string | null {
  const m = /^release\/v(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(branch);
  return m ? `${m[1]}.${m[2]}` : null;
}

/** True if core `version` belongs to line `"X.Y"`. */
export function versionInLine(version: string, line: string): boolean {
  return (
    isCoreVersion(version) &&
    `${String(semver.major(version))}.${String(semver.minor(version))}` === line
  );
}

/** Parse + validate a `version.json` document. Throws `UsageError` on any problem. */
export function parseVersionFile(raw: string, label = 'version.json'): VersionFile {
  let meta: unknown;
  try {
    meta = JSON.parse(raw);
  } catch (err) {
    throw new UsageError(
      `${label} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }
  if (typeof meta !== 'object' || meta === null) {
    throw new UsageError(`${label}: expected a JSON object`);
  }
  const record = meta as Record<string, unknown>;
  const { channel, version } = record;
  if (!isChannel(channel)) {
    throw new UsageError(`${label}: 'channel' must be one of ${CHANNELS.join(', ')}`);
  }
  if (!isCoreVersion(version)) {
    throw new UsageError(`${label}: 'version' must be a plain SemVer version (X.Y.Z)`);
  }
  return { channel, version };
}

/** Canonical `version.json` text the tooling writes. */
export function versionFileText({ channel, version }: VersionFile): string {
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

/** `1.3.0`, `1.3.0-beta.2`, `1.3.0-rc.10` — shapes a public release tag may take. */
export function isReleaseTagVersion(v: unknown): boolean {
  if (isCoreVersion(v)) return true;
  if (typeof v !== 'string' && typeof v !== 'number') return false;
  const parsed = semver.parse(String(v));
  if (parsed === null) return false;
  if (parsed.prerelease.length !== 2) return false;
  const [id, n] = parsed.prerelease;
  return isPrereleaseChannel(id) && typeof n === 'number' && Number.isInteger(n) && n >= 1;
}

export interface DeriveBuildVersionInput {
  readonly versionFile: VersionFile;
  /** git ref (`GITHUB_REF`). */
  readonly ref?: string;
  /** deterministic build number (GitHub run number). */
  readonly build?: number | string;
  /** short commit id for build metadata (optional). */
  readonly sha?: string;
}

/**
 * Derive the CI build version. A tag ref (`refs/tags/vX.Y.Z[-beta|rc.N]`) is the
 * version itself — never re-derived from `version.json`.
 */
export function deriveBuildVersion({
  versionFile,
  ref = '',
  build = 0,
  sha = '',
}: DeriveBuildVersionInput): string {
  if (ref.startsWith('refs/tags/')) {
    const v = ref.slice('refs/tags/'.length).replace(/^v/, '');
    if (!isReleaseTagVersion(v)) {
      throw new UsageError(
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
    throw new UsageError(`build must be a non-negative integer, got ${JSON.stringify(build)}`);
  }
  const base = `${version}-${channel}.${String(buildNum)}`;
  return sha ? `${base}+${sha}` : base;
}

interface MaxPrereleaseInput {
  readonly version: string;
  readonly channel: PrereleaseChannel;
  readonly existingTags: readonly string[];
  readonly caller: string;
}

function maxPrereleaseNumber({
  version,
  channel,
  existingTags,
  caller,
}: MaxPrereleaseInput): number {
  if (!isCoreVersion(version)) {
    throw new UsageError(`${caller}: bad version ${JSON.stringify(version)}`);
  }
  if (!isPrereleaseChannel(channel)) {
    throw new UsageError(
      `${caller}: channel must be 'beta' or 'rc', got ${JSON.stringify(channel)}`,
    );
  }
  let max = 0;
  for (const t of existingTags) {
    const p = semver.parse(t.trim().replace(/^v/, ''));
    if (
      p &&
      p.version.startsWith(`${version}-`) &&
      semver.major(p) === semver.major(version) &&
      semver.minor(p) === semver.minor(version) &&
      semver.patch(p) === semver.patch(version) &&
      p.prerelease.length === 2 &&
      p.prerelease[0] === channel &&
      typeof p.prerelease[1] === 'number' &&
      Number.isInteger(p.prerelease[1])
    ) {
      max = Math.max(max, p.prerelease[1]);
    }
  }
  return max;
}

export interface PrereleaseTagInput {
  readonly version: string;
  readonly channel: PrereleaseChannel;
  readonly existingTags: readonly string[];
}

/** Next intentional prerelease tag for a target version + channel. */
export function nextPrereleaseTag({ version, channel, existingTags }: PrereleaseTagInput): string {
  const max = maxPrereleaseNumber({ version, channel, existingTags, caller: 'nextPrereleaseTag' });
  return `v${version}-${channel}.${String(max + 1)}`;
}

/**
 * The highest intentional prerelease tag that already exists for this
 * version + channel, or `null`. Lets the release flow notice an orphaned last
 * tag before it would skip ahead to the next number.
 */
export function highestPrereleaseTag({
  version,
  channel,
  existingTags,
}: PrereleaseTagInput): string | null {
  const max = maxPrereleaseNumber({
    version,
    channel,
    existingTags,
    caller: 'highestPrereleaseTag',
  });
  return max === 0 ? null : `v${version}-${channel}.${String(max)}`;
}

/**
 * Legal channel promotion on a release branch:
 *   beta -> rc            (same version)
 *   rc   -> stable        (same version)
 *   stable -> beta | rc   (starts the next patch: X.Y.Z -> X.Y.(Z+1))
 */
export function planPromotion({
  current,
  toChannel,
}: {
  current: VersionFile;
  toChannel: Channel;
}): VersionFile {
  const { channel, version } = current;
  if (channel === 'beta' && toChannel === 'rc') return { channel: 'rc', version };
  if (channel === 'rc' && toChannel === 'stable') return { channel: 'stable', version };
  if (channel === 'stable' && (toChannel === 'beta' || toChannel === 'rc')) {
    return { channel: toChannel, version: semver.inc(version, 'patch') ?? version };
  }
  throw new UsageError(
    `Invalid promotion ${channel} -> ${toChannel}. Allowed: beta->rc, rc->stable, ` +
      `stable->beta|rc (starts the next patch).`,
  );
}
