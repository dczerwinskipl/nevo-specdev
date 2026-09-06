import { describe, expect, it } from 'vitest';

import {
  resolveTransitionTarget,
  validateVersionTransition,
} from '../../src/domain/transitions.js';
import type { VersionFile } from '../../src/domain/version.js';

const T = (from: VersionFile, to: VersionFile, targetBranch: string) =>
  validateVersionTransition({ from, to, targetBranch });

describe('validateVersionTransition — judged by the target branch', () => {
  it('unchanged is always ok', () => {
    expect(
      T({ channel: 'alpha', version: '0.1.0' }, { channel: 'alpha', version: '0.1.0' }, 'main'),
    ).toEqual({ ok: true, kind: 'unchanged' });
  });

  it('main-line bump: next minor or major .0 only', () => {
    expect(
      T({ channel: 'alpha', version: '1.3.0' }, { channel: 'alpha', version: '1.4.0' }, 'main'),
    ).toMatchObject({ kind: 'main-bump' });
    expect(
      T({ channel: 'alpha', version: '1.3.0' }, { channel: 'alpha', version: '2.0.0' }, 'main'),
    ).toMatchObject({ kind: 'main-bump' });
    expect(
      T({ channel: 'alpha', version: '1.3.0' }, { channel: 'alpha', version: '1.5.0' }, 'main').ok,
    ).toBe(false);
  });

  it('line cut: alpha X.Y.0 -> beta X.Y.0 on the matching release branch', () => {
    expect(
      T(
        { channel: 'alpha', version: '1.3.0' },
        { channel: 'beta', version: '1.3.0' },
        'release/v1.3',
      ),
    ).toMatchObject({ kind: 'line-cut' });
    expect(
      T(
        { channel: 'alpha', version: '1.3.0' },
        { channel: 'beta', version: '1.3.0' },
        'release/v1.4',
      ).ok,
    ).toBe(false);
  });

  it('promotion is judged by the PR base branch, not the head branch', () => {
    expect(
      T({ channel: 'beta', version: '1.3.0' }, { channel: 'rc', version: '1.3.0' }, 'release/v1.3'),
    ).toMatchObject({ kind: 'promotion' });
    expect(
      T(
        { channel: 'rc', version: '1.3.0' },
        { channel: 'stable', version: '1.3.0' },
        'release/v1.3',
      ),
    ).toMatchObject({ kind: 'promotion' });
    expect(
      T(
        { channel: 'stable', version: '1.3.0' },
        { channel: 'beta', version: '1.3.1' },
        'release/v1.3',
      ),
    ).toMatchObject({ kind: 'promotion' });
  });

  it('illegal promotions and cross-line versions are rejected', () => {
    expect(
      T(
        { channel: 'beta', version: '1.3.0' },
        { channel: 'stable', version: '1.3.0' },
        'release/v1.3',
      ).ok,
    ).toBe(false);
    expect(
      T({ channel: 'beta', version: '1.3.0' }, { channel: 'rc', version: '1.3.0' }, 'main').ok,
    ).toBe(false);
    expect(
      T(
        { channel: 'rc', version: '1.3.0' },
        { channel: 'stable', version: '1.4.0' },
        'release/v1.3',
      ).ok,
    ).toBe(false);
  });
});

describe('resolveTransitionTarget', () => {
  const resolve = (opts: {
    env?: Record<string, string | undefined>;
    working?: VersionFile | Error;
    refs?: string[];
  }) =>
    resolveTransitionTarget({
      env: opts.env ?? {},
      readWorkingVersion: () => {
        if (opts.working instanceof Error) throw opts.working;
        return opts.working ?? { channel: 'alpha', version: '0.1.0' };
      },
      refExists: (ref) => (opts.refs ?? []).includes(ref),
    });

  it('a PR resolves to its BASE branch, not its head branch', () => {
    const r = resolve({
      env: { GITHUB_BASE_REF: 'release/v1.3', GITHUB_HEAD_REF: 'chore/promote-1.3-to-rc' },
    });
    expect(r).toEqual({
      targetBranch: 'release/v1.3',
      baseRef: 'origin/release/v1.3',
      source: 'pull_request base release/v1.3',
    });
  });

  it('a branch push resolves to the pushed branch with HEAD~1 as base', () => {
    const r = resolve({
      env: { GITHUB_REF: 'refs/heads/release/v1.3', GITHUB_REF_NAME: 'release/v1.3' },
    });
    expect(r).toMatchObject({ targetBranch: 'release/v1.3', baseRef: 'HEAD~1' });
  });

  it('local: an alpha working tree resolves to main', () => {
    expect(resolve({ working: { channel: 'alpha', version: '1.4.0' } })).toMatchObject({
      targetBranch: 'main',
      baseRef: 'origin/main',
    });
  });

  it('local: a release-channel working tree resolves to its release/vX.Y line', () => {
    expect(
      resolve({ working: { channel: 'rc', version: '1.3.2' }, refs: ['origin/release/v1.3'] }),
    ).toMatchObject({ targetBranch: 'release/v1.3', baseRef: 'origin/release/v1.3' });
  });

  it('local: a release-channel working tree whose line is missing on origin errors', () => {
    const r = resolve({ working: { channel: 'beta', version: '1.3.0' }, refs: [] });
    expect(r).toHaveProperty('error');
  });

  it('local: an unreadable version.json errors rather than guessing', () => {
    const r = resolve({ working: new Error('ENOENT') });
    expect(r).toHaveProperty('error');
  });

  it('BASE_REF is NOT honoured — the ambiguous override was removed', () => {
    // A stray BASE_REF must not steer the resolution.
    const r = resolve({ env: { BASE_REF: 'origin/release/v9.9' } });
    expect(r).toMatchObject({ targetBranch: 'main' });
  });
});
