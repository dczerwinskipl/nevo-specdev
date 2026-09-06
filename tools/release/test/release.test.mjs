import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  decideReleaseAction,
  evaluateRequiredChecks,
  latestCheckRunsByName,
  pickReleaseCandidate,
  planRelease,
  REQUIRED_HEAD_CHECKS,
} from '../src/release.mjs';

const onV13 = (channel, version, existingTags = []) =>
  planRelease({ branch: 'release/v1.3', channel, versionFile: { channel, version }, existingTags });

test('required HEAD checks do not include the PR-only pr-title check', () => {
  assert.deepEqual([...REQUIRED_HEAD_CHECKS], ['quality', 'test', 'build']);
});

test('beta release picks the next intentional beta number', () => {
  assert.deepEqual(onV13('beta', '1.3.0'), {
    errors: [],
    tag: 'v1.3.0-beta.1',
    channel: 'beta',
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

// ── pickReleaseCandidate (§3 end-to-end partial-release recovery) ─────────
// planRelease alone would jump to beta.2 the moment a beta.1 tag exists — even
// if that beta.1 is an orphan (tag pushed, GitHub Release never created). The
// candidate pick runs BEFORE tagging and repairs that.

const pick = (o) => pickReleaseCandidate({ plannedTag: 'v1.3.0-beta.2', prerelease: true, ...o });

test('no prior beta tags → the planned beta.1, not recovering', () => {
  assert.deepEqual(
    pickReleaseCandidate({
      plannedTag: 'v1.3.0-beta.1',
      prerelease: true,
      highestTag: null,
      highestTagState: null,
    }),
    { tag: 'v1.3.0-beta.1', recovering: false },
  );
});

test('beta.1 tag + Release both exist → advance to the planned beta.2', () => {
  assert.deepEqual(
    pick({ highestTag: 'v1.3.0-beta.1', highestTagState: { state: 'ok', release: true } }),
    { tag: 'v1.3.0-beta.2', recovering: false },
  );
});

test('beta.1 tag on HEAD but Release missing → recover beta.1, NOT beta.2', () => {
  assert.deepEqual(
    pick({ highestTag: 'v1.3.0-beta.1', highestTagState: { state: 'ok', release: false } }),
    { tag: 'v1.3.0-beta.1', recovering: true },
  );
});

test('orphan beta.1 sits on a different commit → do not reuse it, plan beta.2', () => {
  assert.deepEqual(
    pick({ highestTag: 'v1.3.0-beta.1', highestTagState: { state: 'mismatch', release: false } }),
    { tag: 'v1.3.0-beta.2', recovering: false },
  );
});

test('same recovery invariant for the rc channel', () => {
  assert.deepEqual(
    pickReleaseCandidate({
      plannedTag: 'v1.3.0-rc.3',
      prerelease: true,
      highestTag: 'v1.3.0-rc.2',
      highestTagState: { state: 'ok', release: false },
    }),
    { tag: 'v1.3.0-rc.2', recovering: true },
  );
});

test('stable (not a prerelease) never enters sequence recovery', () => {
  assert.deepEqual(
    pickReleaseCandidate({
      plannedTag: 'v1.3.0',
      prerelease: false,
      highestTag: null,
      highestTagState: null,
    }),
    { tag: 'v1.3.0', recovering: false },
  );
});

// ── check-run selection (§11) ────────────────────────────────────────────

test('latestCheckRunsByName keeps the newest run id per check name', () => {
  const byName = latestCheckRunsByName([
    { name: 'quality', status: 'completed', conclusion: 'failure', id: 1 },
    { name: 'quality', status: 'completed', conclusion: 'success', id: 5 }, // re-run
    { name: 'test', status: 'completed', conclusion: 'success', id: 2 },
    { name: 'build', status: 'in_progress', conclusion: null, id: 9 },
    { id: 10 }, // junk without a name — ignored
  ]);
  assert.equal(byName.get('quality').conclusion, 'success');
  assert.equal(byName.get('quality').id, 5);
  assert.equal(byName.size, 3);
});

test('latestCheckRunsByName never lets an older success mask a newer failure', () => {
  const byName = latestCheckRunsByName([
    { name: 'test', status: 'completed', conclusion: 'success', id: 100 },
    { name: 'test', status: 'completed', conclusion: 'failure', id: 101 },
  ]);
  const { notPassing } = evaluateRequiredChecks(byName, ['test']);
  assert.deepEqual(notPassing, ['test (completed/failure)']);
});

test('evaluateRequiredChecks reports missing and in-progress required checks', () => {
  const byName = latestCheckRunsByName([
    { name: 'quality', status: 'completed', conclusion: 'success', id: 1 },
    { name: 'test', status: 'in_progress', conclusion: null, id: 2 },
  ]);
  const { missing, notPassing } = evaluateRequiredChecks(byName, ['quality', 'test', 'build']);
  assert.deepEqual(missing, ['build']);
  assert.deepEqual(notPassing, ['test (in_progress/pending)']);
});

test('evaluateRequiredChecks passes only when every required check is completed/success', () => {
  const byName = latestCheckRunsByName([
    { name: 'quality', status: 'completed', conclusion: 'success', id: 1 },
    { name: 'test', status: 'completed', conclusion: 'success', id: 2 },
    { name: 'build', status: 'completed', conclusion: 'success', id: 3 },
    { name: 'pr-title', status: 'completed', conclusion: 'failure', id: 4 }, // not required on HEAD
  ]);
  assert.deepEqual(evaluateRequiredChecks(byName, [...REQUIRED_HEAD_CHECKS]), {
    missing: [],
    notPassing: [],
  });
});

test('a chosen candidate that already exists elsewhere is still refused downstream', () => {
  // pick yields the planned beta.2; decideReleaseAction then catches the clash.
  const chosen = pick({
    highestTag: 'v1.3.0-beta.1',
    highestTagState: { state: 'mismatch', release: true },
  });
  assert.equal(chosen.tag, 'v1.3.0-beta.2');
  const d = decideReleaseAction(
    { state: 'mismatch', release: false },
    { tag: chosen.tag, headShort: 'abc1234', branch: 'release/v1.3' },
  );
  assert.ok('error' in d);
});
