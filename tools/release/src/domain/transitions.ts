// version.json transition rules (§13) — pure. A change to version.json must be a
// legal transition for the branch it LANDS on (the protected target branch),
// never for the short-lived source branch a PR is raised from.

import semver from 'semver';

import { lineOfBranch, planPromotion, versionInLine, type VersionFile } from './version.js';

export type TransitionKind = 'unchanged' | 'main-bump' | 'line-cut' | 'promotion';

export type TransitionVerdict =
  | { readonly ok: true; readonly kind: TransitionKind }
  | { readonly ok: false; readonly error: string };

/**
 * Validate a `version.json` change from `from` to `to` as it will land on
 * `targetBranch` — the PR **base** branch, or the pushed branch. A PR into
 * `main` is judged as `main`; a PR into `release/v1.3` as `release/v1.3`.
 */
export function validateVersionTransition({
  from,
  to,
  targetBranch,
}: {
  from: VersionFile;
  to: VersionFile;
  targetBranch: string;
}): TransitionVerdict {
  if (from.channel === to.channel && from.version === to.version) {
    return { ok: true, kind: 'unchanged' };
  }

  const line = lineOfBranch(targetBranch);

  // main development-line bump: alpha stays alpha; version steps to the next
  // minor or major .0.
  if (from.channel === 'alpha' && to.channel === 'alpha') {
    const bumpMinor = semver.inc(from.version, 'minor');
    const bumpMajor = semver.inc(from.version, 'major');
    if (to.version === bumpMinor || to.version === bumpMajor) {
      return { ok: true, kind: 'main-bump' };
    }
    return {
      ok: false,
      error: `main-line bump must go to ${bumpMinor ?? '?'} or ${bumpMajor ?? '?'}, got ${to.version}`,
    };
  }

  // Cutting a line: the first commit on release/vX.Y takes main's version to beta.
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

export interface ResolveTransitionTargetInput {
  /** environment (a `process.env` slice). */
  readonly env: Readonly<Record<string, string | undefined>>;
  /** parse the working-tree version.json. */
  readonly readWorkingVersion: () => VersionFile;
  /** does this git ref resolve to a commit? */
  readonly refExists: (ref: string) => boolean;
}

export type TransitionTarget =
  | { readonly targetBranch: string; readonly baseRef: string; readonly source: string }
  | { readonly error: string };

/**
 * Decide which protected branch's rules a `version.json` change must satisfy and
 * which git ref holds the "from" version.json. Pure — every environment lookup
 * and repo probe is injected.
 *
 * Resolution order:
 *   1. `GITHUB_BASE_REF`   a PR — the base branch is the state machine being
 *                          mutated; base version.json is `origin/<base>`.
 *   2. `GITHUB_REF` heads  a push — the pushed branch is the target; the prior
 *                          state is `HEAD~1`.
 *   3. local               infer from the working-tree version.json channel:
 *                          `alpha` -> `main`; any release channel -> its
 *                          `release/vX.Y` (which must exist on `origin`).
 */
export function resolveTransitionTarget({
  env,
  readWorkingVersion,
  refExists,
}: ResolveTransitionTargetInput): TransitionTarget {
  const base = env.GITHUB_BASE_REF;
  if (base) {
    return {
      targetBranch: base,
      baseRef: `origin/${base}`,
      source: `pull_request base ${base}`,
    };
  }
  const ref = env.GITHUB_REF;
  if (ref?.startsWith('refs/heads/')) {
    const pushed = env.GITHUB_REF_NAME ?? ref.slice('refs/heads/'.length);
    return { targetBranch: pushed, baseRef: 'HEAD~1', source: `push to ${pushed}` };
  }

  let vf: VersionFile;
  try {
    vf = readWorkingVersion();
  } catch (err) {
    return {
      error:
        `cannot read the working-tree version.json to infer the comparison target: ` +
        `${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const line = `${String(semver.major(vf.version))}.${String(semver.minor(vf.version))}`;
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
      `  run 'git fetch origin' if the line was cut elsewhere.`,
  };
}
