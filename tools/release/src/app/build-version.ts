// Use case: derive the CI build version for the current branch / ref.

import { deriveBuildVersion, type VersionFile } from '../domain/version.js';

export interface BuildVersionEnv {
  readonly GITHUB_REF?: string;
  readonly GITHUB_RUN_NUMBER?: string;
  readonly GITHUB_SHA?: string;
}

export function resolveBuildVersion(
  versionFile: VersionFile,
  env: BuildVersionEnv,
  { withSha = false }: { withSha?: boolean } = {},
): string {
  const rawSha = env.GITHUB_SHA ?? '';
  return deriveBuildVersion({
    versionFile,
    ref: env.GITHUB_REF ?? '',
    build: env.GITHUB_RUN_NUMBER ?? '0',
    sha: withSha && rawSha ? rawSha.slice(0, 7) : '',
  });
}
