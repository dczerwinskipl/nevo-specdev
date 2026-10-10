import { HttpClientError } from '@nevo/http-client';
import { describe, expect, it } from 'vitest';
import { getHttpErrorStatus } from './httpErrorStatus';

describe('Specification HTTP error status', () => {
  it('reads status from a normalized HttpClientError', () => {
    const error = new HttpClientError('Forbidden', { kind: 'http', status: 403 });
    expect(getHttpErrorStatus(error)).toBe(403);
  });

  it('reads status from an injected API error with a structural status', () => {
    expect(getHttpErrorStatus({ status: 404, message: 'Not found' })).toBe(404);
  });

  it('does not turn unrelated errors into HTTP errors', () => {
    expect(getHttpErrorStatus(new Error('Disconnected'))).toBeUndefined();
    expect(getHttpErrorStatus({ status: '403' })).toBeUndefined();
    expect(getHttpErrorStatus(null)).toBeUndefined();
  });
});
