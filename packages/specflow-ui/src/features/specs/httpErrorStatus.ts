import { isHttpClientError } from '@nevo/http-client';

/**
 * Reads an HTTP status from the protected transport or an injected typed API.
 * Both Workspace screens and cached navigation metadata must classify the
 * same error consistently (especially when a previously cached resource was
 * later denied or deleted).
 */
export function getHttpErrorStatus(error: unknown): number | undefined {
  if (isHttpClientError(error)) return error.status;
  if (error && typeof error === 'object' && 'status' in error) {
    const status = error.status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}
