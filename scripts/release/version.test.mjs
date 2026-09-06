import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  deriveBuildVersion,
  isReleaseTagVersion,
  isSemverCore,
  lineOfBranch,
  nextPrereleaseTag,
  parseSemverCore,
  planPromotion,
  readVersionFile,
  releaseBranchFor,
  versionInLine,
} from './version.mjs';

test('isSemverCore accepts X.Y.Z only', () => {
  assert.equal(isSemverCore('1.4.7'), true);
  assert.equal(isSemverCore('0.0.0'), true);
  assert.equal(isSemverCore('1.4'), false);
  assert.equal(isSemverCore('1.4.7-rc.1'), false);
  assert.equal(isSemverCore('v1.4.7'), false);
});

test('parseSemverCore / releaseBranchFor / lineOfBranch / versionInLine', () => {
  assert.deepEqual(parseSemverCore('12.4.30'), { major: 12, minor: 4, patch: 30 });
  assert.throws(() => parseSemverCore('1.3'));
  assert.equal(releaseBranchFor('1.3.2'), 'release/v1.3');
  assert.equal(lineOfBranch('release/v1.3'), '1.3');
  assert.equal(lineOfBranch('release/v1.3.1'), null);
  assert.equal(lineOfBranch('main'), null);
  assert.equal(versionInLine('1.3.4', '1.3'), true);
  assert.equal(versionInLine('1.4.0', '1.3'), false);
});

// ── deriveBuildVersion: every ref shape from the review ─────────────────────

test('main alpha build', () => {
  assert.equal(
    deriveBuildVersion({
      versionFile: { channel: 'alpha', version: '1.4.0' },
      ref: 'refs/heads/main',
      build: 128,
    }),
    '1.4.0-alpha.128',
  );
});

test('release branch beta / rc builds', () => {
  assert.equal(
    deriveBuildVersion({
      versionFile: { channel: 'beta', version: '1.3.0' },
      ref: 'refs/heads/release/v1.3',
      build: 5,
    }),
    '1.3.0-beta.5',
  );
  assert.equal(
    deriveBuildVersion({
      versionFile: { channel: 'rc', version: '1.3.0' },
      ref: 'refs/heads/release/v1.3',
      build: 9,
    }),
    '1.3.0-rc.9',
  );
});

test('stable channel drops the prerelease/build suffix', () => {
  assert.equal(
    deriveBuildVersion({
      versionFile: { channel: 'stable', version: '1.3.0' },
      ref: 'refs/heads/release/v1.3',
      build: 999,
    }),
    '1.3.0',
  );
});

test('patch RC and patch stable builds', () => {
  assert.equal(
    deriveBuildVersion({
      versionFile: { channel: 'rc', version: '1.3.1' },
      ref: 'refs/heads/release/v1.3',
      build: 3,
    }),
    '1.3.1-rc.3',
  );
  assert.equal(
    deriveBuildVersion({
      versionFile: { channel: 'stable', version: '1.3.1' },
      ref: 'refs/heads/release/v1.3',
      build: 3,
    }),
    '1.3.1',
  );
});

test('a tag ref is the version verbatim — never re-derived as alpha', () => {
  const vf = { channel: 'alpha', version: '9.9.9' }; // deliberately mismatched
  assert.equal(deriveBuildVersion({ versionFile: vf, ref: 'refs/tags/v1.3.0', build: 7 }), '1.3.0');
  assert.equal(
    deriveBuildVersion({ versionFile: vf, ref: 'refs/tags/v1.3.0-rc.2', build: 7 }),
    '1.3.0-rc.2',
  );
  assert.throws(
    () => deriveBuildVersion({ versionFile: vf, ref: 'refs/tags/nightly', build: 7 }),
    /not a release version tag/,
  );
});

test('build metadata appended only with a sha, and non-integer build rejected', () => {
  assert.equal(
    deriveBuildVersion({
      versionFile: { channel: 'alpha', version: '0.1.0' },
      ref: 'refs/heads/main',
      build: 2,
      sha: 'abc1234',
    }),
    '0.1.0-alpha.2+abc1234',
  );
  assert.throws(() =>
    deriveBuildVersion({
      versionFile: { channel: 'alpha', version: '0.1.0' },
      ref: 'refs/heads/main',
      build: 'x',
    }),
  );
});

// ── nextPrereleaseTag ──────────────────────────────────────────────────────

test('nextPrereleaseTag counts an intentional sequence, not the build number', () => {
  assert.equal(
    nextPrereleaseTag({ version: '1.3.0', channel: 'beta', existingTags: [] }),
    'v1.3.0-beta.1',
  );
  assert.equal(
    nextPrereleaseTag({
      version: '1.3.0',
      channel: 'beta',
      existingTags: ['v1.3.0-beta.1', 'v1.3.0-beta.2', 'v1.2.9-beta.5'],
    }),
    'v1.3.0-beta.3',
  );
  assert.equal(
    nextPrereleaseTag({
      version: '1.3.0',
      channel: 'rc',
      existingTags: ['v1.3.0-beta.3'],
    }),
    'v1.3.0-rc.1',
  );
  assert.throws(() => nextPrereleaseTag({ version: '1.3.0', channel: 'stable', existingTags: [] }));
});

test('isReleaseTagVersion', () => {
  assert.equal(isReleaseTagVersion('1.3.0'), true);
  assert.equal(isReleaseTagVersion('1.3.0-beta.2'), true);
  assert.equal(isReleaseTagVersion('1.3.0-rc.10'), true);
  assert.equal(isReleaseTagVersion('1.3.0-alpha.2'), false); // alpha is not a public tag channel
  assert.equal(isReleaseTagVersion('1.3.0-beta'), false);
});

// ── planPromotion ─────────────────────────────────────────────────────────

test('planPromotion: beta->rc->stable keeps the version', () => {
  assert.deepEqual(
    planPromotion({ current: { channel: 'beta', version: '1.3.0' }, toChannel: 'rc' }),
    {
      channel: 'rc',
      version: '1.3.0',
    },
  );
  assert.deepEqual(
    planPromotion({ current: { channel: 'rc', version: '1.3.0' }, toChannel: 'stable' }),
    { channel: 'stable', version: '1.3.0' },
  );
});

test('planPromotion: stable->rc starts the next patch', () => {
  assert.deepEqual(
    planPromotion({ current: { channel: 'stable', version: '1.3.0' }, toChannel: 'rc' }),
    { channel: 'rc', version: '1.3.1' },
  );
});

test('planPromotion rejects illegal transitions', () => {
  assert.throws(() =>
    planPromotion({ current: { channel: 'beta', version: '1.3.0' }, toChannel: 'stable' }),
  );
  assert.throws(() =>
    planPromotion({ current: { channel: 'alpha', version: '1.4.0' }, toChannel: 'beta' }),
  );
});

// ── readVersionFile ───────────────────────────────────────────────────────

test('readVersionFile validates channel and version', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nevo-vf-'));
  try {
    writeFileSync(join(dir, 'version.json'), JSON.stringify({ channel: 'beta', version: '1.3.0' }));
    assert.deepEqual(readVersionFile(dir), { channel: 'beta', version: '1.3.0' });

    writeFileSync(join(dir, 'version.json'), JSON.stringify({ channel: 'nope', version: '1.3.0' }));
    assert.throws(() => readVersionFile(dir), /channel/);

    writeFileSync(join(dir, 'version.json'), JSON.stringify({ channel: 'beta', version: '1.3' }));
    assert.throws(() => readVersionFile(dir), /plain SemVer/);

    writeFileSync(join(dir, 'version.json'), '{ not json');
    assert.throws(() => readVersionFile(dir), /not valid JSON/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the repository version.json parses', () => {
  const vf = readVersionFile();
  assert.ok(['alpha', 'beta', 'rc', 'stable'].includes(vf.channel));
  assert.equal(isSemverCore(vf.version), true);
});
