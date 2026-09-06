// Base/target resolution for the version.json transition gate (§13, BLOCKER #1/#2).
// resolveTransitionTarget is pure — env, working-tree version.json and ref
// existence are all injected — so we exercise real CI-shaped contexts here
// rather than only calling validateVersionTransition in isolation.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveTransitionTarget, validateVersionTransition } from '../src/version.mjs';

/** @param {object} [o] */
const resolve = ({ env = {}, working = { channel: 'alpha', version: '0.1.0' }, refs = [] } = {}) =>
  resolveTransitionTarget({
    env,
    readWorkingVersion: () => {
      if (working instanceof Error) throw working;
      return working;
    },
    refExists: (ref) => refs.includes(ref),
  });

test('BASE_REF is an explicit override: that ref is both target and base', () => {
  assert.deepEqual(resolve({ env: { BASE_REF: 'origin/release/v2.0' } }), {
    targetBranch: 'origin/release/v2.0',
    baseRef: 'origin/release/v2.0',
    source: 'BASE_REF override',
  });
});

test('a PR resolves to its BASE branch, not its head branch', () => {
  // GITHUB_HEAD_REF is deliberately a promote branch — it must be ignored.
  const r = resolve({
    env: { GITHUB_BASE_REF: 'release/v1.3', GITHUB_HEAD_REF: 'chore/promote-1.3-to-rc' },
  });
  assert.equal(r.targetBranch, 'release/v1.3');
  assert.equal(r.baseRef, 'origin/release/v1.3');
});

test('a feature PR into main resolves to main', () => {
  const r = resolve({ env: { GITHUB_BASE_REF: 'main', GITHUB_HEAD_REF: 'feature/x' } });
  assert.equal(r.targetBranch, 'main');
  assert.equal(r.baseRef, 'origin/main');
});

test('a branch push resolves to the pushed branch with HEAD~1 as base', () => {
  const r = resolve({
    env: { GITHUB_REF: 'refs/heads/release/v1.3', GITHUB_REF_NAME: 'release/v1.3' },
  });
  assert.equal(r.targetBranch, 'release/v1.3');
  assert.equal(r.baseRef, 'HEAD~1');
});

test('local: an alpha working tree resolves to main', () => {
  const r = resolve({ working: { channel: 'alpha', version: '1.4.0' } });
  assert.equal(r.targetBranch, 'main');
  assert.equal(r.baseRef, 'origin/main');
});

test('local: a release-channel working tree resolves to its release/vX.Y line', () => {
  const r = resolve({
    working: { channel: 'rc', version: '1.3.2' },
    refs: ['origin/release/v1.3'],
  });
  assert.equal(r.targetBranch, 'release/v1.3');
  assert.equal(r.baseRef, 'origin/release/v1.3');
});

test('local: a release-channel working tree whose line is not on origin fails with instructions', () => {
  const r = resolve({ working: { channel: 'beta', version: '1.3.0' }, refs: [] });
  assert.ok('error' in r);
  assert.match(r.error, /release\/v1\.3.*does not exist/s);
  assert.match(r.error, /BASE_REF/);
});

test('local: an unreadable version.json fails rather than guessing', () => {
  const r = resolve({ working: new Error('ENOENT: no version.json') });
  assert.ok('error' in r);
  assert.match(r.error, /cannot read the working-tree version\.json/);
});

// ── resolution + validation together, in the exact bug scenario ───────────

test('promotion PR head branch name cannot break a legal release-line transition', () => {
  const resolved = resolve({
    env: { GITHUB_BASE_REF: 'release/v1.3', GITHUB_HEAD_REF: 'chore/promote-1.3-to-rc' },
  });
  assert.ok(!('error' in resolved));
  const verdict = validateVersionTransition({
    from: { channel: 'beta', version: '1.3.0' },
    to: { channel: 'rc', version: '1.3.0' },
    targetBranch: resolved.targetBranch,
  });
  assert.deepEqual(verdict, { ok: true, kind: 'promotion' });
});

test('a main-line minor bump pushed from any branch validates against main', () => {
  const resolved = resolve({ env: { GITHUB_BASE_REF: 'main', GITHUB_HEAD_REF: 'chore/bump-x' } });
  const verdict = validateVersionTransition({
    from: { channel: 'alpha', version: '1.3.0' },
    to: { channel: 'alpha', version: '1.4.0' },
    targetBranch: resolved.targetBranch,
  });
  assert.equal(verdict.kind, 'main-bump');
});
