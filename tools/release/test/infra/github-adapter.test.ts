// Pure-logic tests for the GitHub adapter's fail-closed decisions:
//   * classifyReleaseLookup — absent vs exists vs indeterminate, from the HTTP
//     status code only (never human stderr);
//   * resolveGhEnv — how CI_GITHUB_RELEASE_TOKEN maps onto GH_TOKEN locally.

import { describe, expect, it } from 'vitest';

import { classifyReleaseLookup, resolveGhEnv } from '../../src/infra/github.js';

describe('classifyReleaseLookup — absent vs indeterminate', () => {
  it('HTTP 200 -> the Release exists', () => {
    expect(classifyReleaseLookup({ stdout: 'HTTP/2.0 200 OK\nx: y\n', exitCode: 0 })).toEqual({
      outcome: 'exists',
    });
  });

  it('HTTP 404 -> confirmed absent', () => {
    expect(classifyReleaseLookup({ stdout: 'HTTP/1.1 404 Not Found\n', exitCode: 1 })).toEqual({
      outcome: 'absent',
    });
  });

  it.each([
    ['auth', 'HTTP/2.0 401 Unauthorized\n', 1],
    ['permission', 'HTTP/2.0 403 Forbidden\n', 1],
    ['rate limit', 'HTTP/2.0 429 Too Many Requests\n', 1],
    ['server error', 'HTTP/2.0 502 Bad Gateway\n', 1],
  ] as const)('HTTP status for %s -> indeterminate, not absent', (_label, stdout, exitCode) => {
    const r = classifyReleaseLookup({ stdout, exitCode });
    expect(r.outcome).toBe('indeterminate');
  });

  it('no HTTP status line at all (network failure) -> indeterminate, not absent', () => {
    const r = classifyReleaseLookup({ stdout: '', exitCode: null });
    expect(r.outcome).toBe('indeterminate');
    if (r.outcome === 'indeterminate') expect(r.reason).toMatch(/no HTTP status line/);
  });

  it('a body that merely contains the text "Not Found" is NOT read as 404', () => {
    const r = classifyReleaseLookup({
      stdout: 'HTTP/2.0 403 Forbidden\n\n{"message":"Not Found"}',
      exitCode: 1,
    });
    expect(r.outcome).toBe('indeterminate');
  });
});

describe('resolveGhEnv — local CI_GITHUB_RELEASE_TOKEN -> GH_TOKEN', () => {
  it('maps CI_GITHUB_RELEASE_TOKEN onto GH_TOKEN when no gh token is set', () => {
    expect(resolveGhEnv({ CI_GITHUB_RELEASE_TOKEN: 'abc' })).toEqual({ GH_TOKEN: 'abc' });
  });

  it('never overrides an explicit GH_TOKEN', () => {
    expect(resolveGhEnv({ GH_TOKEN: 'real', CI_GITHUB_RELEASE_TOKEN: 'abc' })).toBeUndefined();
  });

  it('never overrides an explicit GITHUB_TOKEN', () => {
    expect(resolveGhEnv({ GITHUB_TOKEN: 'real', CI_GITHUB_RELEASE_TOKEN: 'abc' })).toBeUndefined();
  });

  it('no tokens at all -> no override', () => {
    expect(resolveGhEnv({})).toBeUndefined();
  });
});
