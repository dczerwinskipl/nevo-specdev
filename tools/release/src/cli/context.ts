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

export function hasReleaseToken(env: Readonly<Record<string, string | undefined>>): boolean {
  return env.RELEASE_TOKEN_PRESENT === 'true' || Boolean(env.RELEASE_TOKEN);
}

export function wantsExecute(
  optExecute: boolean,
  env: Readonly<Record<string, string | undefined>>,
): boolean {
  return optExecute || env.EXECUTE === 'true';
}
