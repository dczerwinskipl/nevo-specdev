// Pure planning for `nevo-release cut-line`. No I/O.

import semver from 'semver';

import { isCoreVersion, releaseBranchFor, type VersionFile } from './version.js';

export type CutStep = 'minor' | 'major';

export type CutPlan =
  | { readonly ok: false; readonly errors: string[] }
  | {
      readonly ok: true;
      readonly errors: [];
      readonly releaseBranch: string;
      readonly releaseVersion: string;
      readonly nextVersion: string;
      readonly bumpBranch: string;
      readonly step: CutStep;
    };

/** Validate the two versions and derive branch/line names. */
export function planReleaseCut({
  releaseVersion,
  nextDevelopmentVersion,
}: {
  releaseVersion: string;
  nextDevelopmentVersion: string;
}): CutPlan {
  const errors: string[] = [];
  for (const [label, v] of [
    ['--release-version', releaseVersion],
    ['--next-development-version', nextDevelopmentVersion],
  ] as const) {
    if (!isCoreVersion(v)) {
      errors.push(`${label} must be a plain SemVer version (got ${JSON.stringify(v)})`);
    }
  }
  if (errors.length) return { ok: false, errors };

  const nextMinor = semver.inc(releaseVersion, 'minor');
  const nextMajor = semver.inc(releaseVersion, 'major');
  const isNextMinor = nextDevelopmentVersion === nextMinor;
  const isNextMajor = nextDevelopmentVersion === nextMajor;
  if (!isNextMinor && !isNextMajor) {
    return {
      ok: false,
      errors: [
        `--next-development-version ${nextDevelopmentVersion} is neither the next minor ` +
          `(${nextMinor ?? '?'}) nor the next major (${nextMajor ?? '?'}) of ${releaseVersion}.`,
      ],
    };
  }

  return {
    ok: true,
    errors: [],
    releaseBranch: releaseBranchFor(releaseVersion),
    releaseVersion,
    nextVersion: nextDevelopmentVersion,
    bumpBranch: `chore/bump-main-to-${nextDevelopmentVersion}`,
    step: isNextMajor ? 'major' : 'minor',
  };
}

/**
 * Validate `origin/main`'s OWN `version.json` (read at the fetched base commit,
 * never the working tree) against the requested cut: `main` must be an `alpha`
 * line whose version is exactly the one being stabilized, and the next
 * development version must be that version's next minor or major.
 */
export function validateCutBaseVersion(
  mainVersionFile: VersionFile,
  { releaseVersion, nextVersion }: { releaseVersion: string; nextVersion: string },
): string[] {
  const errors: string[] = [];
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
      `--next-development-version ${nextVersion} is neither the next minor (${nextMinor ?? '?'}) ` +
        `nor the next major (${nextMajor ?? '?'}) of main's ${mainVersionFile.version}.`,
    );
  }
  return errors;
}
