import assert from 'node:assert/strict';
import { test } from 'node:test';

import { deriveVersion, isSemverCore, parseSemverCore, releaseBranchFor } from './version.mjs';

const meta = {
  development: { line: '0.1.0', channel: 'alpha' },
  releaseLines: [{ branch: 'release/v0.1', version: '0.1.0', status: 'maintained' }],
};

test('isSemverCore accepts X.Y.Z only', () => {
  assert.equal(isSemverCore('1.4.7'), true);
  assert.equal(isSemverCore('0.0.0'), true);
  assert.equal(isSemverCore('1.4'), false);
  assert.equal(isSemverCore('1.4.7-alpha.1'), false);
  assert.equal(isSemverCore('v1.4.7'), false);
});

test('parseSemverCore / releaseBranchFor', () => {
  assert.deepEqual(parseSemverCore('12.4.30'), { major: 12, minor: 4, patch: 30 });
  assert.equal(releaseBranchFor('1.3.2'), 'release/v1.3');
  assert.throws(() => parseSemverCore('1.3'));
});

test('main ref → <line>-<channel>.<build>', () => {
  assert.equal(deriveVersion({ meta, ref: 'refs/heads/main', build: 128 }), '0.1.0-alpha.128');
});

test('build metadata appended only when a sha is given', () => {
  assert.equal(
    deriveVersion({ meta, ref: 'refs/heads/main', build: 5, sha: 'abc1234' }),
    '0.1.0-alpha.5+abc1234',
  );
});

test('non-branch ref falls back to the development line', () => {
  assert.equal(deriveVersion({ meta, ref: '', build: 0 }), '0.1.0-alpha.0');
});

test('release branch → exact recorded version, no prerelease stamp', () => {
  assert.equal(deriveVersion({ meta, ref: 'refs/heads/release/v0.1', build: 999 }), '0.1.0');
});

test('release branch with no version.json entry is an error', () => {
  assert.throws(
    () => deriveVersion({ meta, ref: 'refs/heads/release/v9.9', build: 1 }),
    /No entry in version\.json#releaseLines/,
  );
});

test('negative or non-integer build is rejected', () => {
  assert.throws(() => deriveVersion({ meta, ref: 'refs/heads/main', build: -1 }));
  assert.throws(() => deriveVersion({ meta, ref: 'refs/heads/main', build: 'x' }));
});
