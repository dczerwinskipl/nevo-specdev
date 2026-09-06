// Error model for the release tooling.
//
// Domain/application code THROWS these for operations that cannot complete;
// expected planning/validation outcomes are returned as typed results instead.
// Only the CLI boundary (bin.ts) turns a thrown error into stderr text + an
// exit code — nothing below it calls process.exit.

/** Base class so the CLI can recognise an intentional, message-safe failure. */
export class ReleaseToolError extends Error {
  override readonly name: string = 'ReleaseToolError';
}

/** Bad CLI input, environment, or arguments. Maps to exit code 2. */
export class UsageError extends ReleaseToolError {
  override readonly name = 'UsageError';
}

/**
 * The remote/repository is in a state the tool will not act on (a tag or branch
 * that points somewhere unexpected, a `version.json` that fails validation at
 * the base commit, …). Fail closed. Maps to exit code 1.
 */
export class InconsistentStateError extends ReleaseToolError {
  override readonly name = 'InconsistentStateError';
}

/** Narrow `unknown` from a `catch` to a message string. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
