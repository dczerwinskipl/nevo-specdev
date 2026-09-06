import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decideReleaseAction, planRelease, REQUIRED_HEAD_CHECKS } from '../src/release.mjs';

const onV13 = (channel, version, existingTags = []) =>
  planRelease({ branch: 'release/v1.3', channel, versionFile: { channel, version }, existingTags });

test('required HEAD checks do not include the PR-only pr-title check', () => {
  assert.deepEqual([...REQUIRED_HEAD_CHECKS], ['quality', 'test', 'build']);
});

test('beta release picks the next intentional beta number', () => {
  assert.deepEqual(onV13('beta', '1.3.0'), {
    errors: [],
    tag: 'v1.3.0-beta.1',
    prerelease: true,
    version: '1.3.0',
  });
  assert.equal(onV13('beta', '1.3.0', ['v1.3.0-beta.1', 'v1.3.0-beta.2']).tag, 'v1.3.0-beta.3');
});

test('rc release starts its own sequence', () => {
  assert.equal(onV13('rc', '1.3.0', ['v1.3.0-beta.2']).tag, 'v1.3.0-rc.1');
});

test('stable release is v<version> and carries the next-branch-state advance', () => {
  const p = onV13('stable', '1.3.0');
  assert.equal(p.tag, 'v1.3.0');
  assert.equal(p.prerelease, false);
  assert.deepEqual(p.nextBranchState, { channel: 'beta', version: '1.3.1' });
});

test('patch stable / patch rc', () => {
  assert.equal(onV13('stable', '1.3.1').tag, 'v1.3.1');
  assert.deepEqual(onV13('stable', '1.3.1').nextBranchState, { channel: 'beta', version: '1.3.2' });
  assert.equal(onV13('rc', '1.3.1', ['v1.3.1-rc.1']).tag, 'v1.3.1-rc.2');
});

test('refuses a release from main or a non-release branch', () => {
  const p = planRelease({
    branch: 'main',
    channel: 'stable',
    versionFile: { channel: 'stable', version: '1.3.0' },
    existingTags: [],
  });
  assert.match(p.errors[0], /must be cut from a release\/vX\.Y branch/);
});

test('refuses when version.json version is off-line or channel mismatches', () => {
  assert.match(
    planRelease({
      branch: 'release/v1.3',
      channel: 'stable',
      versionFile: { channel: 'stable', version: '1.4.0' },
      existingTags: [],
    }).errors.join('\n'),
    /does not belong to line 1\.3/,
  );
  assert.match(
    planRelease({
      branch: 'release/v1.3',
      channel: 'stable',
      versionFile: { channel: 'rc', version: '1.3.0' },
      existingTags: [],
    }).errors.join('\n'),
    /Branch is in channel 'rc', not 'stable'/,
  );
});

test('rejects an unknown channel', () => {
  assert.match(onV13('ga', '1.3.0').errors[0], /--channel must be one of/);
});

// ── decideReleaseAction (§11 partial-state recovery) ──────────────────────

const ctx = { tag: 'v1.3.0-beta.2', headShort: 'abc1234', branch: 'release/v1.3' };

test('fresh tag → tag-and-release', () => {
  assert.deepEqual(
    decideReleaseAction({ state: 'absent', release: false }, ctx).action,
    'tag-and-release',
  );
});

test('tag exists at HEAD but no Release → create just the Release (no sequence bump)', () => {
  assert.equal(decideReleaseAction({ state: 'ok', release: false }, ctx).action, 'create-release');
});

test('tag + Release both present and consistent → noop', () => {
  assert.equal(decideReleaseAction({ state: 'ok', release: true }, ctx).action, 'noop');
});

test('tag exists but points elsewhere → refuse loudly', () => {
  const d = decideReleaseAction({ state: 'mismatch', release: false }, ctx);
  assert.ok('error' in d);
  assert.match(d.error, /points at a different commit/);
});
