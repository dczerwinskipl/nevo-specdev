// Public surface of nevo-repo-release — imported by tests and (potentially) by
// other repository tooling. The executable is `./bin.ts`.

export * from './errors.js';
export * from './domain/version.js';
export * from './domain/transitions.js';
export * from './domain/release-plan.js';
export * from './domain/cut-plan.js';
export type {
  GitClient,
  GitHubClient,
  PullRequestRef,
  ReadWorkingVersion,
  Logger,
} from './ports.js';
export type { ActionEvent } from './app/events.js';
export { resolveBuildVersion } from './app/build-version.js';
export {
  checkVersionTransition,
  type CheckTransitionDeps,
  type TransitionCheckOutcome,
} from './app/check-transition.js';
export {
  executeReleaseCut,
  type CutReleaseLineDeps,
  type CutReleaseLineResult,
} from './app/cut-release-line.js';
export {
  executeRelease,
  type CreateReleaseDeps,
  type CreateReleaseResult,
} from './app/create-release.js';
export {
  promoteRelease,
  promotionBranchName,
  type PromoteDeps,
  type PromoteResult,
  type PromotionTarget,
} from './app/promote.js';
export {
  ensureVersionFileChangePr,
  checkSingleVersionFileCommit,
  requestAutoMerge,
  type EnsureVersionFilePrResult,
  type VersionPrStatus,
} from './app/version-pr.js';
export { createProgram } from './cli/program.js';
export type { CliContext } from './cli/context.js';
export { hasCiGithubReleaseToken, wantsExecute } from './cli/context.js';
