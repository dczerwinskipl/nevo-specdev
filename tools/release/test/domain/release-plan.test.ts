import { describe, expect, it } from 'vitest';

import {
  decideReleaseAction,
  evaluateRequiredChecks,
  latestCheckRunsByName,
  pickReleaseCandidate,
  planRelease,
  REQUIRED_HEAD_CHECKS,
  type ExistingTag,
} from '../../src/domain/release-plan.js';
import type { VersionFile } from '../../src/domain/version.js';

const onV13 = (channel: string, version: string, existingTags: string[] = []) =>
  planRelease({
    branch: 'release/v1.3',
    channel,
    versionFile: { channel: channel as VersionFile['channel'], version },
    existingTags,
  });

describe('planRelease', () => {
  it('required HEAD checks exclude the PR-only pr-title check', () => {
    expect([...REQUIRED_HEAD_CHECKS]).toEqual(['quality', 'test', 'build']);
  });

  it('beta picks the next intentional number', () => {
    expect(onV13('beta', '1.3.0')).toMatchObject({
      ok: true,
      tag: 'v1.3.0-beta.1',
      channel: 'beta',
    });
    expect(onV13('beta', '1.3.0', ['v1.3.0-beta.1', 'v1.3.0-beta.2'])).toMatchObject({
      tag: 'v1.3.0-beta.3',
    });
  });

  it('rc starts its own sequence; stable is v<version> and carries the advance', () => {
    expect(onV13('rc', '1.3.0', ['v1.3.0-beta.2'])).toMatchObject({ tag: 'v1.3.0-rc.1' });
    const stable = onV13('stable', '1.3.0');
    expect(stable).toMatchObject({
      tag: 'v1.3.0',
      prerelease: false,
      nextBranchState: { channel: 'beta', version: '1.3.1' },
    });
  });

  it('refuses a non-release branch, off-line version, or channel mismatch', () => {
    expect(
      planRelease({
        branch: 'main',
        channel: 'stable',
        versionFile: { channel: 'stable', version: '1.3.0' },
        existingTags: [],
      }),
    ).toMatchObject({ ok: false });
    expect(onV13('stable', '1.4.0')).toMatchObject({ ok: false });
    const wrongChannel = planRelease({
      branch: 'release/v1.3',
      channel: 'stable',
      versionFile: { channel: 'rc', version: '1.3.0' },
      existingTags: [],
    });
    expect(wrongChannel.ok).toBe(false);
    expect(!wrongChannel.ok && wrongChannel.errors.join('\n')).toMatch(/not 'stable'/);
  });
});

describe('pickReleaseCandidate (§3 partial-release recovery)', () => {
  const pick = (o: Partial<Parameters<typeof pickReleaseCandidate>[0]>) =>
    pickReleaseCandidate({
      plannedTag: 'v1.3.0-beta.2',
      prerelease: true,
      highestTag: null,
      highestTagState: null,
      ...o,
    });
  const state = (over: Partial<ExistingTag>): ExistingTag => ({
    state: 'ok',
    release: false,
    ...over,
  });

  it('no prior tags -> planned', () => {
    expect(pick({ plannedTag: 'v1.3.0-beta.1' })).toEqual({
      tag: 'v1.3.0-beta.1',
      recovering: false,
    });
  });
  it('beta.1 tag + Release -> advance to planned beta.2', () => {
    expect(
      pick({ highestTag: 'v1.3.0-beta.1', highestTagState: state({ release: true }) }),
    ).toEqual({
      tag: 'v1.3.0-beta.2',
      recovering: false,
    });
  });
  it('orphan beta.1 on HEAD -> recover beta.1, NOT beta.2', () => {
    expect(pick({ highestTag: 'v1.3.0-beta.1', highestTagState: state({}) })).toEqual({
      tag: 'v1.3.0-beta.1',
      recovering: true,
    });
  });
  it('orphan beta.1 elsewhere -> plan beta.2', () => {
    expect(
      pick({ highestTag: 'v1.3.0-beta.1', highestTagState: state({ state: 'mismatch' }) }),
    ).toEqual({ tag: 'v1.3.0-beta.2', recovering: false });
  });
});

describe('decideReleaseAction', () => {
  const ctx = { tag: 'v1.3.0-beta.2', headShort: 'abc1234', branch: 'release/v1.3' };
  it('covers the partial-state matrix', () => {
    expect(decideReleaseAction({ state: 'absent', release: false }, ctx)).toMatchObject({
      action: 'tag-and-release',
    });
    expect(decideReleaseAction({ state: 'ok', release: false }, ctx)).toMatchObject({
      action: 'create-release',
    });
    expect(decideReleaseAction({ state: 'ok', release: true }, ctx)).toMatchObject({
      action: 'noop',
    });
    expect(decideReleaseAction({ state: 'mismatch', release: false }, ctx)).toHaveProperty('error');
  });
});

describe('check-run selection (§11)', () => {
  it('keeps the newest run per name and never lets an old success mask a new failure', () => {
    const byName = latestCheckRunsByName([
      { name: 'test', status: 'completed', conclusion: 'success', id: 100 },
      { name: 'test', status: 'completed', conclusion: 'failure', id: 101 },
      { name: 'quality', status: 'completed', conclusion: 'success', id: 5 },
      { name: 'build', status: 'in_progress', conclusion: null, id: 9 },
      { id: 12 },
    ]);
    expect(byName.size).toBe(3);
    const { missing, notPassing } = evaluateRequiredChecks(byName, [...REQUIRED_HEAD_CHECKS]);
    expect(missing).toEqual([]);
    expect(notPassing).toEqual(['test (completed/failure)', 'build (in_progress/pending)']);
  });

  it('passes only when every required check is completed/success', () => {
    const byName = latestCheckRunsByName([
      { name: 'quality', status: 'completed', conclusion: 'success', id: 1 },
      { name: 'test', status: 'completed', conclusion: 'success', id: 2 },
      { name: 'build', status: 'completed', conclusion: 'success', id: 3 },
    ]);
    expect(evaluateRequiredChecks(byName, [...REQUIRED_HEAD_CHECKS])).toEqual({
      missing: [],
      notPassing: [],
    });
  });
});
