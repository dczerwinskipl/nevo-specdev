import assert from 'node:assert/strict';
import { test } from 'node:test';

import { planReleaseCut, validateCutBaseVersion } from '../src/cut-release-line.mjs';

test('next minor is accepted', () => {
  const p = planReleaseCut({ releaseVersion: '0.1.0', nextDevelopmentVersion: '0.2.0' });
  assert.deepEqual(p.errors, []);
  assert.equal(p.releaseBranch, 'release/v0.1');
  assert.equal(p.nextVersion, '0.2.0');
  assert.equal(p.bumpBranch, 'chore/bump-main-to-0.2.0');
  assert.equal(p.step, 'minor');
});

test('next major is accepted', () => {
  const p = planReleaseCut({ releaseVersion: '1.3.0', nextDevelopmentVersion: '2.0.0' });
  assert.deepEqual(p.errors, []);
  assert.equal(p.releaseBranch, 'release/v1.3');
  assert.equal(p.step, 'major');
});

test('skipping a minor is rejected', () => {
  const p = planReleaseCut({ releaseVersion: '1.3.0', nextDevelopmentVersion: '1.5.0' });
  assert.equal(p.errors.length, 1);
  assert.match(p.errors[0], /neither the next minor .* nor the next major/);
  assert.equal(p.releaseBranch, undefined);
});

test('a lower / equal / non-.0 next version is rejected', () => {
  assert.equal(
    planReleaseCut({ releaseVersion: '1.3.0', nextDevelopmentVersion: '1.2.0' }).errors.length,
    1,
  );
  assert.equal(
    planReleaseCut({ releaseVersion: '1.3.0', nextDevelopmentVersion: '1.3.0' }).errors.length,
    1,
  );
  assert.equal(
    planReleaseCut({ releaseVersion: '1.3.0', nextDevelopmentVersion: '1.4.1' }).errors.length,
    1,
  );
});

test('non-semver inputs are rejected before planning', () => {
  const p = planReleaseCut({ releaseVersion: 'v1.3', nextDevelopmentVersion: '1.4' });
  assert.equal(p.errors.length, 2);
});

// ── validateCutBaseVersion (§4 — main's own state gates the cut) ──────────

const cut = { releaseVersion: '1.3.0', nextVersion: '1.4.0' };

test('main is alpha and on the release version → no errors', () => {
  assert.deepEqual(validateCutBaseVersion({ channel: 'alpha', version: '1.3.0' }, cut), []);
});

test('main channel is not alpha → rejected', () => {
  assert.match(
    validateCutBaseVersion({ channel: 'beta', version: '1.3.0' }, cut).join('\n'),
    /not 'alpha'/,
  );
});

test('main is developing a different version than --release-version → rejected', () => {
  assert.match(
    validateCutBaseVersion({ channel: 'alpha', version: '1.4.0' }, cut).join('\n'),
    /origin\/main is developing 1\.4\.0, but --release-version is 1\.3\.0/,
  );
});

test('next development version is not the next minor/major of main → rejected', () => {
  assert.match(
    validateCutBaseVersion(
      { channel: 'alpha', version: '1.3.0' },
      {
        releaseVersion: '1.3.0',
        nextVersion: '1.5.0',
      },
    ).join('\n'),
    /neither the next minor \(1\.4\.0\) nor the next major \(2\.0\.0\)/,
  );
  assert.deepEqual(
    validateCutBaseVersion(
      { channel: 'alpha', version: '1.3.0' },
      {
        releaseVersion: '1.3.0',
        nextVersion: '2.0.0',
      },
    ),
    [],
  );
});
