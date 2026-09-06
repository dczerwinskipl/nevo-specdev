// Public surface of nevo-repo-release — imported by the bin/ CLIs and by tests.

export {
  CHANNELS,
  TAG_PRERELEASE_CHANNELS,
  isCoreVersion,
  isReleaseTagVersion,
  releaseBranchFor,
  lineOfBranch,
  versionInLine,
  readVersionFile,
  parseVersionFile,
  versionFileText,
  deriveBuildVersion,
  nextPrereleaseTag,
  highestPrereleaseTag,
  planPromotion,
  validateVersionTransition,
  resolveTransitionTarget,
} from './version.mjs';
export { planReleaseCut, executeReleaseCut, validateCutBaseVersion } from './cut-release-line.mjs';
export {
  REQUIRED_HEAD_CHECKS,
  planRelease,
  pickReleaseCandidate,
  latestCheckRunsByName,
  evaluateRequiredChecks,
  verifyHeadChecksPassed,
  inspectTagState,
  decideReleaseAction,
  executeRelease,
} from './release.mjs';
