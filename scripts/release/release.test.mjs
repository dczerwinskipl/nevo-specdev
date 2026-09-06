import assert from 'node:assert/strict';
import { test } from 'node:test';

import { planRelease } from './release.mjs';

const onV13 = (channel, version, existingTags = []) =>
  planRelease({
    branch: 'release/v1.3',
    channel,
    versionFile: { channel, version },
    existingTags,
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

test('stable release is v<version>, and refuses a duplicate', () => {
  assert.deepEqual(onV13('stable', '1.3.0'), {
    errors: [],
    tag: 'v1.3.0',
    prerelease: false,
    version: '1.3.0',
  });
  assert.match(onV13('stable', '1.3.0', ['v1.3.0']).errors[0], /already exists/);
});

test('patch stable / patch rc', () => {
  assert.equal(onV13('stable', '1.3.1').tag, 'v1.3.1');
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

test('refuses when version.json version is off-line', () => {
  const p = planRelease({
    branch: 'release/v1.3',
    channel: 'stable',
    versionFile: { channel: 'stable', version: '1.4.0' },
    existingTags: [],
  });
  assert.match(p.errors.join('\n'), /does not belong to line 1\.3/);
});

test('refuses when the branch channel does not match the requested channel', () => {
  const p = planRelease({
    branch: 'release/v1.3',
    channel: 'stable',
    versionFile: { channel: 'rc', version: '1.3.0' },
    existingTags: [],
  });
  assert.match(p.errors.join('\n'), /Branch is in channel 'rc', not 'stable'/);
});

test('rejects an unknown channel', () => {
  assert.match(onV13('ga', '1.3.0').errors[0], /--channel must be one of/);
});
