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
  planPromotion,
  validateVersionTransition,
} from './version.mjs';
export { planReleaseCut, executeReleaseCut } from './cut-release-line.mjs';
export {
  REQUIRED_HEAD_CHECKS,
  planRelease,
  verifyHeadChecksPassed,
  inspectTagState,
  executeRelease,
} from './release.mjs';
