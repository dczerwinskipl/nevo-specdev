// Error model for the docs tooling. Domain/application throws these; only the
// CLI boundary turns them into stderr + an exit code.

export class DocsToolError extends Error {
  override readonly name: string = 'DocsToolError';
}

/** Bad CLI input / arguments. Exit code 2. */
export class UsageError extends DocsToolError {
  override readonly name = 'UsageError';
}

/** The documentation corpus failed validation. Exit code 1. */
export class CorpusInvalidError extends DocsToolError {
  override readonly name = 'CorpusInvalidError';
  constructor(readonly problems: readonly string[]) {
    super(`documentation corpus is invalid:\n  - ${problems.join('\n  - ')}`);
  }
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
