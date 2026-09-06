import type { VersionFile } from '../domain/version.js';
import type { SyncGitReader } from '../infra/git-sync.js';
import type { GitClient, GitHubClient, Logger } from '../ports.js';

/** Everything the CLI commands need from the outside world, injected once. */
export interface CliContext {
  readonly git: GitClient;
  readonly github: GitHubClient;
  readonly syncGit: SyncGitReader;
  readonly readWorkingVersion: () => VersionFile;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly stdout: Logger;
  readonly stderr: Logger;
}

/**
 * Is the CI GitHub release credential available? `CI_GITHUB_RELEASE_TOKEN` is a
 * fine-grained PAT scoped to this repository, used only when a release workflow
 * must open a PR whose `pull_request` CI must run (the default `GITHUB_TOKEN`
 * cannot trigger that). `CI_GITHUB_RELEASE_TOKEN_PRESENT=true` is set by the
 * workflow; locally, the token being in the environment is enough.
 */
export function hasCiGithubReleaseToken(
  env: Readonly<Record<string, string | undefined>>,
): boolean {
  return env.CI_GITHUB_RELEASE_TOKEN_PRESENT === 'true' || Boolean(env.CI_GITHUB_RELEASE_TOKEN);
}

export function wantsExecute(
  optExecute: boolean,
  env: Readonly<Record<string, string | undefined>>,
): boolean {
  return optExecute || env.EXECUTE === 'true';
}
