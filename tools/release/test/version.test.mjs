import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  CHANNELS,
  deriveBuildVersion,
  isCoreVersion,
  isReleaseTagVersion,
  lineOfBranch,
  nextPrereleaseTag,
  parseVersionFile,
  planPromotion,
  readVersionFile,
  releaseBranchFor,
  validateVersionTransition,
  versionFileText,
  versionInLine,
} from '../src/version.mjs';

test('isCoreVersion accepts X.Y.Z only', () => {
  assert.equal(isCoreVersion('1.4.7'), true);
  assert.equal(isCoreVersion('0.0.0'), true);
  assert.equal(isCoreVersion('1.4'), false);
  assert.equal(isCoreVersion('1.4.7-rc.1'), false);
  assert.equal(isCoreVersion('v1.4.7'), false);
});

test('releaseBranchFor / lineOfBranch / versionInLine', () => {
  assert.equal(releaseBranchFor('1.3.2'), 'release/v1.3');
  assert.throws(() => releaseBranchFor('1.3'));
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

test('release beta / rc builds', () => {
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
  const vf = { channel: 'alpha', version: '9.9.9' };
  assert.equal(deriveBuildVersion({ versionFile: vf, ref: 'refs/tags/v1.3.0', build: 7 }), '1.3.0');
  assert.equal(
    deriveBuildVersion({ versionFile: vf, ref: 'refs/tags/v1.3.0-rc.2', build: 7 }),
    '1.3.0-rc.2',
  );
  assert.throws(
    () => deriveBuildVersion({ versionFile: vf, ref: 'refs/tags/nightly', build: 7 }),
    /not a release version tag/,
  );
  assert.throws(
    () => deriveBuildVersion({ versionFile: vf, ref: 'refs/tags/v1.3.0-alpha.1', build: 7 }),
    /not a release version tag/,
  );
});

test('non-integer build is rejected; sha appends build metadata', () => {
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

test('nextPrereleaseTag is an intentional sequence, not the build number', () => {
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
    nextPrereleaseTag({ version: '1.3.0', channel: 'rc', existingTags: ['v1.3.0-beta.3'] }),
    'v1.3.0-rc.1',
  );
  assert.throws(() => nextPrereleaseTag({ version: '1.3.0', channel: 'stable', existingTags: [] }));
});

test('isReleaseTagVersion', () => {
  assert.equal(isReleaseTagVersion('1.3.0'), true);
  assert.equal(isReleaseTagVersion('1.3.0-beta.2'), true);
  assert.equal(isReleaseTagVersion('1.3.0-rc.10'), true);
  assert.equal(isReleaseTagVersion('1.3.0-alpha.2'), false);
  assert.equal(isReleaseTagVersion('1.3.0-beta'), false);
  assert.equal(isReleaseTagVersion('1.3.0-beta.0'), false);
});

// ── planPromotion ─────────────────────────────────────────────────────────

test('planPromotion: beta->rc->stable keeps the version; stable->beta|rc starts the next patch', () => {
  assert.deepEqual(
    planPromotion({ current: { channel: 'beta', version: '1.3.0' }, toChannel: 'rc' }),
    { channel: 'rc', version: '1.3.0' },
  );
  assert.deepEqual(
    planPromotion({ current: { channel: 'rc', version: '1.3.0' }, toChannel: 'stable' }),
    { channel: 'stable', version: '1.3.0' },
  );
  assert.deepEqual(
    planPromotion({ current: { channel: 'stable', version: '1.3.0' }, toChannel: 'beta' }),
    { channel: 'beta', version: '1.3.1' },
  );
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
    planPromotion({ current: { channel: 'rc', version: '1.3.0' }, toChannel: 'beta' }),
  );
  assert.throws(() =>
    planPromotion({ current: { channel: 'alpha', version: '1.4.0' }, toChannel: 'beta' }),
  );
});

// ── validateVersionTransition (§13) ───────────────────────────────────────
// `targetBranch` is the protected branch the change lands on (the PR *base*, or
// the pushed branch) — never the head branch a PR is raised from.

const T = (from, to, targetBranch) => validateVersionTransition({ from, to, targetBranch });

test('unchanged version.json is always ok (feature PR into main, no version bump)', () => {
  assert.deepEqual(
    T({ channel: 'alpha', version: '0.1.0' }, { channel: 'alpha', version: '0.1.0' }, 'main'),
    { ok: true, kind: 'unchanged' },
  );
});

test('main-line bump: next minor or major .0 only (target = main)', () => {
  assert.equal(
    T({ channel: 'alpha', version: '1.3.0' }, { channel: 'alpha', version: '1.4.0' }, 'main').kind,
    'main-bump',
  );
  assert.equal(
    T({ channel: 'alpha', version: '1.3.0' }, { channel: 'alpha', version: '2.0.0' }, 'main').kind,
    'main-bump',
  );
  assert.equal(
    T({ channel: 'alpha', version: '1.3.0' }, { channel: 'alpha', version: '1.5.0' }, 'main').ok,
    false,
  );
  assert.equal(
    T({ channel: 'alpha', version: '1.3.0' }, { channel: 'alpha', version: '1.4.1' }, 'main').ok,
    false,
  );
});

test('line cut: alpha X.Y.0 -> beta X.Y.0 on the matching release branch', () => {
  assert.equal(
    T({ channel: 'alpha', version: '1.3.0' }, { channel: 'beta', version: '1.3.0' }, 'release/v1.3')
      .kind,
    'line-cut',
  );
  assert.equal(
    T({ channel: 'alpha', version: '1.3.0' }, { channel: 'beta', version: '1.3.0' }, 'release/v1.4')
      .ok,
    false,
  );
});

test('promotion is validated against the PR base branch, not the head branch', () => {
  // The real bug: a PR from `chore/promote-1.3-to-rc` INTO `release/v1.3`.
  // The head branch name is irrelevant — only the target `release/v1.3` matters.
  assert.equal(
    T({ channel: 'beta', version: '1.3.0' }, { channel: 'rc', version: '1.3.0' }, 'release/v1.3')
      .kind,
    'promotion',
  );
  assert.equal(
    T({ channel: 'rc', version: '1.3.0' }, { channel: 'stable', version: '1.3.0' }, 'release/v1.3')
      .kind,
    'promotion',
  );
  assert.equal(
    T(
      { channel: 'stable', version: '1.3.0' },
      { channel: 'beta', version: '1.3.1' },
      'release/v1.3',
    ).kind,
    'promotion',
  );
});

test('illegal promotions and cross-line versions are rejected', () => {
  // beta -> stable skips rc.
  assert.equal(
    T(
      { channel: 'beta', version: '1.3.0' },
      { channel: 'stable', version: '1.3.0' },
      'release/v1.3',
    ).ok,
    false,
  );
  // A promotion change in a PR that targets `main` is nonsense.
  assert.equal(
    T({ channel: 'beta', version: '1.3.0' }, { channel: 'rc', version: '1.3.0' }, 'main').ok,
    false,
  );
  // rc 1.3.0 -> stable 1.4.0 is a legal channel step but the version leaves line 1.3.
  assert.equal(
    T({ channel: 'rc', version: '1.3.0' }, { channel: 'stable', version: '1.4.0' }, 'release/v1.3')
      .ok,
    false,
  );
});

// ── readVersionFile / parseVersionFile ────────────────────────────────────

test('parseVersionFile validates channel and version; versionFileText round-trips', () => {
  const text = versionFileText({ channel: 'beta', version: '1.3.0' });
  assert.deepEqual(parseVersionFile(text), { channel: 'beta', version: '1.3.0' });
  assert.throws(() => parseVersionFile('{"channel":"nope","version":"1.3.0"}'), /channel/);
  assert.throws(() => parseVersionFile('{"channel":"beta","version":"1.3"}'), /plain SemVer/);
  assert.throws(() => parseVersionFile('{ not json'), /not valid JSON/);
});

test('the repository version.json parses', () => {
  const vf = readVersionFile();
  assert.ok(CHANNELS.includes(vf.channel));
  assert.equal(isCoreVersion(vf.version), true);
});

test('readVersionFile reads from an explicit root', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nevo-vf-'));
  try {
    writeFileSync(join(dir, 'version.json'), versionFileText({ channel: 'rc', version: '2.0.0' }));
    assert.deepEqual(readVersionFile(dir), { channel: 'rc', version: '2.0.0' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
