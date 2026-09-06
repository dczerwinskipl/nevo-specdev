import { describe, expect, it } from 'vitest';

import {
  deriveBuildVersion,
  highestPrereleaseTag,
  isCoreVersion,
  isReleaseTagVersion,
  lineOfBranch,
  nextPrereleaseTag,
  parseVersionFile,
  planPromotion,
  releaseBranchFor,
  versionFileText,
  versionInLine,
} from '../../src/domain/version.js';
import { UsageError } from '../../src/errors.js';

describe('isCoreVersion', () => {
  it('accepts X.Y.Z only', () => {
    expect(isCoreVersion('1.4.7')).toBe(true);
    expect(isCoreVersion('0.0.0')).toBe(true);
    expect(isCoreVersion('1.4')).toBe(false);
    expect(isCoreVersion('1.4.7-rc.1')).toBe(false);
    expect(isCoreVersion('v1.4.7')).toBe(false);
  });
});

describe('lineOfBranch / versionInLine / releaseBranchFor', () => {
  it('maps release branches to lines and back', () => {
    expect(lineOfBranch('release/v1.3')).toBe('1.3');
    expect(lineOfBranch('release/v10.0')).toBe('10.0');
    expect(lineOfBranch('main')).toBeNull();
    expect(lineOfBranch('release/v1.3.0')).toBeNull();
    expect(versionInLine('1.3.2', '1.3')).toBe(true);
    expect(versionInLine('1.4.0', '1.3')).toBe(false);
    expect(releaseBranchFor('1.3.9')).toBe('release/v1.3');
    expect(() => releaseBranchFor('1.3')).toThrow(UsageError);
  });
});

describe('parseVersionFile / versionFileText', () => {
  it('round-trips and validates', () => {
    const text = versionFileText({ channel: 'beta', version: '1.3.0' });
    expect(parseVersionFile(text)).toEqual({ channel: 'beta', version: '1.3.0' });
    expect(() => parseVersionFile('{"channel":"nope","version":"1.3.0"}')).toThrow(/channel/);
    expect(() => parseVersionFile('{"channel":"beta","version":"1.3"}')).toThrow(/plain SemVer/);
    expect(() => parseVersionFile('{ not json')).toThrow(/not valid JSON/);
  });
});

describe('deriveBuildVersion', () => {
  it('derives per channel and honours tag refs', () => {
    expect(
      deriveBuildVersion({ versionFile: { channel: 'alpha', version: '0.1.0' }, build: 42 }),
    ).toBe('0.1.0-alpha.42');
    expect(deriveBuildVersion({ versionFile: { channel: 'stable', version: '1.3.0' } })).toBe(
      '1.3.0',
    );
    expect(
      deriveBuildVersion({
        versionFile: { channel: 'alpha', version: '9.9.9' },
        ref: 'refs/tags/v1.3.0-rc.2',
      }),
    ).toBe('1.3.0-rc.2');
    expect(() =>
      deriveBuildVersion({
        versionFile: { channel: 'alpha', version: '1.0.0' },
        ref: 'refs/tags/nope',
      }),
    ).toThrow(UsageError);
  });
});

describe('isReleaseTagVersion', () => {
  it('accepts core and intentional prerelease shapes', () => {
    expect(isReleaseTagVersion('1.3.0')).toBe(true);
    expect(isReleaseTagVersion('1.3.0-beta.1')).toBe(true);
    expect(isReleaseTagVersion('1.3.0-rc.10')).toBe(true);
    expect(isReleaseTagVersion('1.3.0-beta.0')).toBe(false);
    expect(isReleaseTagVersion('1.3.0-alpha.1')).toBe(false);
  });
});

describe('nextPrereleaseTag / highestPrereleaseTag', () => {
  it('computes the intentional sequence from existing tags', () => {
    expect(nextPrereleaseTag({ version: '1.3.0', channel: 'beta', existingTags: [] })).toBe(
      'v1.3.0-beta.1',
    );
    expect(
      nextPrereleaseTag({
        version: '1.3.0',
        channel: 'beta',
        existingTags: ['v1.3.0-beta.1', 'v1.3.0-beta.2'],
      }),
    ).toBe('v1.3.0-beta.3');
    expect(
      nextPrereleaseTag({ version: '1.3.0', channel: 'rc', existingTags: ['v1.3.0-beta.2'] }),
    ).toBe('v1.3.0-rc.1');
    expect(
      highestPrereleaseTag({ version: '1.3.0', channel: 'beta', existingTags: [] }),
    ).toBeNull();
    expect(
      highestPrereleaseTag({
        version: '1.3.0',
        channel: 'beta',
        existingTags: ['v1.3.0-beta.1', 'v1.3.0-beta.3', 'v1.4.0-beta.9'],
      }),
    ).toBe('v1.3.0-beta.3');
  });
});

describe('planPromotion', () => {
  it('allows the legal steps and rejects the rest', () => {
    expect(
      planPromotion({ current: { channel: 'beta', version: '1.3.0' }, toChannel: 'rc' }),
    ).toEqual({ channel: 'rc', version: '1.3.0' });
    expect(
      planPromotion({ current: { channel: 'rc', version: '1.3.0' }, toChannel: 'stable' }),
    ).toEqual({ channel: 'stable', version: '1.3.0' });
    expect(
      planPromotion({ current: { channel: 'stable', version: '1.3.0' }, toChannel: 'beta' }),
    ).toEqual({ channel: 'beta', version: '1.3.1' });
    expect(() =>
      planPromotion({ current: { channel: 'beta', version: '1.3.0' }, toChannel: 'stable' }),
    ).toThrow(UsageError);
  });
});
