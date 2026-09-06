export class GithubToolError extends Error {
  override readonly name: string = 'GithubToolError';
}

/** Bad CLI input. Exit 2. */
export class UsageError extends GithubToolError {
  override readonly name = 'UsageError';
}

/** Governance drift (in --check) or a failed reconciliation. Exit 1. */
export class GovernanceError extends GithubToolError {
  override readonly name = 'GovernanceError';
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
