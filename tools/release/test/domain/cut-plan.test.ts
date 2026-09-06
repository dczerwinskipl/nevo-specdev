import { describe, expect, it } from 'vitest';

import { planReleaseCut, validateCutBaseVersion } from '../../src/domain/cut-plan.js';

describe('planReleaseCut', () => {
  it('accepts the next minor or major', () => {
    expect(
      planReleaseCut({ releaseVersion: '0.1.0', nextDevelopmentVersion: '0.2.0' }),
    ).toMatchObject({
      ok: true,
      releaseBranch: 'release/v0.1',
      bumpBranch: 'chore/bump-main-to-0.2.0',
      step: 'minor',
    });
    expect(
      planReleaseCut({ releaseVersion: '1.3.0', nextDevelopmentVersion: '2.0.0' }),
    ).toMatchObject({ ok: true, step: 'major' });
  });

  it('rejects a skipped minor / non-.0 / non-semver', () => {
    expect(planReleaseCut({ releaseVersion: '1.3.0', nextDevelopmentVersion: '1.5.0' }).ok).toBe(
      false,
    );
    expect(planReleaseCut({ releaseVersion: '1.3.0', nextDevelopmentVersion: '1.4.1' }).ok).toBe(
      false,
    );
    const bad = planReleaseCut({ releaseVersion: 'v1.3', nextDevelopmentVersion: '1.4' });
    expect(bad.ok).toBe(false);
    expect(!bad.ok && bad.errors).toHaveLength(2);
  });
});

describe('validateCutBaseVersion (§4)', () => {
  const cut = { releaseVersion: '1.3.0', nextVersion: '1.4.0' };
  it('passes when main is alpha on the release version', () => {
    expect(validateCutBaseVersion({ channel: 'alpha', version: '1.3.0' }, cut)).toEqual([]);
  });
  it('rejects a non-alpha main', () => {
    expect(validateCutBaseVersion({ channel: 'beta', version: '1.3.0' }, cut).join('\n')).toMatch(
      /not 'alpha'/,
    );
  });
  it('rejects a version mismatch', () => {
    expect(validateCutBaseVersion({ channel: 'alpha', version: '1.4.0' }, cut).join('\n')).toMatch(
      /developing 1\.4\.0, but --release-version is 1\.3\.0/,
    );
  });
  it('rejects a next version that is not the next minor/major of main', () => {
    expect(
      validateCutBaseVersion(
        { channel: 'alpha', version: '1.3.0' },
        { releaseVersion: '1.3.0', nextVersion: '1.5.0' },
      ).join('\n'),
    ).toMatch(/neither the next minor \(1\.4\.0\) nor the next major \(2\.0\.0\)/);
  });
});
