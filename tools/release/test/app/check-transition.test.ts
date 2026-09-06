import { describe, expect, it } from 'vitest';

import { checkVersionTransition } from '../../src/app/check-transition.js';
import { UsageError } from '../../src/errors.js';
import { versionFileText, type VersionFile } from '../../src/domain/version.js';
import { createFakeSyncGit } from '../support/fakes.js';

const run = (opts: {
  env?: Record<string, string | undefined>;
  working: VersionFile;
  files?: Record<string, string>;
  refs?: string[];
}) =>
  checkVersionTransition({
    git: createFakeSyncGit(opts.files ?? {}, opts.refs ?? []),
    readWorkingVersion: () => opts.working,
    env: opts.env ?? {},
  });

describe('checkVersionTransition', () => {
  it('skips when the base ref has no version.json (the bootstrap PR)', () => {
    const out = run({
      env: { GITHUB_BASE_REF: 'main' },
      working: { channel: 'alpha', version: '0.1.0' },
    });
    expect(out.kind).toBe('skipped');
  });

  it('accepts a promotion judged by the PR base, whatever the head branch is', () => {
    const out = run({
      env: { GITHUB_BASE_REF: 'release/v1.3', GITHUB_HEAD_REF: 'chore/promote-1.3-to-rc' },
      working: { channel: 'rc', version: '1.3.0' },
      files: {
        'origin/release/v1.3:version.json': versionFileText({ channel: 'beta', version: '1.3.0' }),
      },
    });
    expect(out).toMatchObject({
      kind: 'ok',
      targetBranch: 'release/v1.3',
      transition: 'promotion',
    });
  });

  it('flags an illegal edit', () => {
    const out = run({
      env: { GITHUB_BASE_REF: 'release/v1.3' },
      working: { channel: 'stable', version: '1.3.0' },
      files: {
        'origin/release/v1.3:version.json': versionFileText({ channel: 'beta', version: '1.3.0' }),
      },
    });
    expect(out.kind).toBe('illegal');
  });

  it('throws UsageError when the target cannot be resolved', () => {
    expect(() => run({ working: { channel: 'beta', version: '1.3.0' }, refs: [] })).toThrow(
      UsageError,
    );
  });

  it('a git read failure (not a missing path) surfaces — it is not read as "skip"', () => {
    expect(() =>
      checkVersionTransition({
        git: {
          refExists: () => true,
          readFileAtRef: () => {
            throw new Error('fatal: bad object store');
          },
        },
        readWorkingVersion: () => ({ channel: 'alpha', version: '0.1.0' }),
        env: { GITHUB_BASE_REF: 'main' },
      }),
    ).toThrow(/bad object store/);
  });
});
