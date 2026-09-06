// Public surface of nevo-repo-github — imported by tests. The executable is `./bin.ts`.

export * from './errors.js';
export * from './domain/diff-partial.js';
export * from './domain/policy.js';
export * from './domain/ruleset.js';
export { configureRepository, type ConfigureResult } from './app/configure-repository.js';
export type { GitHubAdminClient, RulesetSummary, Logger } from './ports.js';
export { createProgram, type GithubCliContext } from './cli/program.js';
