// Pure planning + decision logic for `nevo-release create`. No git, no network —
// every side-effecting fact (tags that exist, whether a Release exists, the
// tag's commit) is passed in, so the whole flow is unit-testable.

import {
  highestPrereleaseTag,
  isPrereleaseChannel,
  isReleaseTagVersion,
  lineOfBranch,
  nextPrereleaseTag,
  planPromotion,
  versionInLine,
  type Channel,
  type PrereleaseChannel,
  type VersionFile,
} from './version.js';

/** Checks that must be green on the release-branch HEAD before tagging. `pr-title` is PR-only. */
export const REQUIRED_HEAD_CHECKS = ['quality', 'test', 'build'] as const;

export type ReleaseChannel = Extract<Channel, 'beta' | 'rc' | 'stable'>;

export type ReleasePlan =
  | { readonly ok: false; readonly errors: string[] }
  | {
      readonly ok: true;
      readonly errors: [];
      readonly tag: string;
      readonly channel: ReleaseChannel;
      readonly version: string;
      readonly prerelease: boolean;
      /** set for a `stable` release — the state the branch advances to afterwards. */
      readonly nextBranchState?: VersionFile;
    };

export interface PlanReleaseInput {
  readonly branch: string;
  readonly channel: string;
  readonly versionFile: VersionFile;
  readonly existingTags: readonly string[];
}

/** Decide which tag a release run should create. */
export function planRelease({
  branch,
  channel,
  versionFile,
  existingTags,
}: PlanReleaseInput): ReleasePlan {
  const errors: string[] = [];
  const line = lineOfBranch(branch);
  if (!line) errors.push(`Releases must be cut from a release/vX.Y branch, not '${branch}'.`);
  if (channel !== 'beta' && channel !== 'rc' && channel !== 'stable') {
    errors.push(`--channel must be one of beta, rc, stable (got ${JSON.stringify(channel)}).`);
  }
  if (errors.length || !line) return { ok: false, errors };
  const releaseChannel = channel as ReleaseChannel;

  if (!versionInLine(versionFile.version, line)) {
    errors.push(`version.json version ${versionFile.version} does not belong to line ${line}.`);
  }
  if (versionFile.channel !== releaseChannel) {
    errors.push(
      `Branch is in channel '${versionFile.channel}', not '${releaseChannel}'. Promote the ` +
        `branch first — merge a PR that sets version.json to this channel ` +
        `(see docs/development/releasing.md).`,
    );
  }
  if (errors.length) return { ok: false, errors };

  const version = versionFile.version;

  if (releaseChannel === 'stable') {
    return {
      ok: true,
      errors: [],
      tag: `v${version}`,
      channel: releaseChannel,
      version,
      prerelease: false,
      nextBranchState: planPromotion({
        current: { channel: 'stable', version },
        toChannel: 'beta',
      }),
    };
  }

  const prereleaseChannel: PrereleaseChannel = releaseChannel;
  const tag = nextPrereleaseTag({
    version,
    channel: prereleaseChannel,
    existingTags: existingTags.map((t) => t.trim()),
  });
  if (!isReleaseTagVersion(tag.replace(/^v/, ''))) {
    return { ok: false, errors: [`Computed tag ${tag} is not a valid release tag.`] };
  }
  return {
    ok: true,
    errors: [],
    tag,
    channel: releaseChannel,
    version,
    prerelease: true,
  };
}

export type TagState = 'absent' | 'ok' | 'mismatch';
export interface ExistingTag {
  readonly state: TagState;
  readonly release: boolean;
}

/**
 * Choose which tag `create` acts on. Normally the planned next number — but if
 * the highest prerelease tag that already exists for this version+channel is on
 * the release-branch HEAD *without* its GitHub Release, that tag is an
 * unfinished previous run: target it and complete the Release rather than
 * skipping ahead to N+1.
 */
export function pickReleaseCandidate({
  plannedTag,
  prerelease,
  highestTag,
  highestTagState,
}: {
  plannedTag: string;
  prerelease: boolean;
  highestTag: string | null;
  highestTagState: ExistingTag | null;
}): { tag: string; recovering: boolean } {
  if (prerelease && highestTag && highestTagState?.state === 'ok' && !highestTagState.release) {
    return { tag: highestTag, recovering: true };
  }
  return { tag: plannedTag, recovering: false };
}

export function highestPrereleaseTagFor(
  version: string,
  channel: ReleaseChannel,
  existingTags: readonly string[],
): string | null {
  if (!isPrereleaseChannel(channel)) return null;
  return highestPrereleaseTag({ version, channel, existingTags });
}

export type ReleaseAction = 'noop' | 'create-release' | 'tag-and-release';
export type ReleaseDecision =
  { readonly action: ReleaseAction; readonly message: string } | { readonly error: string };

/** Pure decision for a possibly-partial prior run: given tag/HEAD/Release state, what should `create` do? */
export function decideReleaseAction(
  existing: ExistingTag,
  { tag, headShort, branch }: { tag: string; headShort: string; branch: string },
): ReleaseDecision {
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

export interface CheckRun {
  readonly name?: unknown;
  readonly status?: unknown;
  readonly conclusion?: unknown;
  readonly id?: unknown;
}
export interface NormalizedCheckRun {
  readonly name: string;
  readonly status: string;
  readonly conclusion: string | null;
  readonly id: number;
}

/**
 * Keep only the newest run per check name. After a re-run GitHub returns both
 * the old and the new run for a name; the newest `id` is the current one.
 */
export function latestCheckRunsByName(runs: readonly CheckRun[]): Map<string, NormalizedCheckRun> {
  const byName = new Map<string, NormalizedCheckRun>();
  for (const r of runs) {
    if (typeof r.name !== 'string') continue;
    const run: NormalizedCheckRun = {
      name: r.name,
      status: typeof r.status === 'string' ? r.status : '',
      conclusion: typeof r.conclusion === 'string' ? r.conclusion : null,
      id: typeof r.id === 'number' ? r.id : 0,
    };
    const prev = byName.get(run.name);
    if (!prev || run.id >= prev.id) byName.set(run.name, run);
  }
  return byName;
}

/** Which required checks are missing / not green, given the latest run per name. */
export function evaluateRequiredChecks(
  byName: ReadonlyMap<string, Pick<NormalizedCheckRun, 'status' | 'conclusion'>>,
  required: readonly string[],
): { missing: string[]; notPassing: string[] } {
  const missing: string[] = [];
  const notPassing: string[] = [];
  for (const name of required) {
    const run = byName.get(name);
    if (!run) missing.push(name);
    else if (run.status !== 'completed' || run.conclusion !== 'success') {
      notPassing.push(`${name} (${run.status || 'unknown'}/${run.conclusion ?? 'pending'})`);
    }
  }
  return { missing, notPassing };
}
