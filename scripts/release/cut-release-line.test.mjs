import assert from 'node:assert/strict';
import { test } from 'node:test';

import { planReleaseCut } from './cut-release-line.mjs';

test('next minor is accepted', () => {
  const plan = planReleaseCut({ releaseVersion: '0.1.0', nextDevelopmentVersion: '0.2.0' });
  assert.deepEqual(plan.errors, []);
  assert.equal(plan.releaseBranch, 'release/v0.1');
  assert.equal(plan.nextLine, '0.2.0');
  assert.equal(plan.bumpBranch, 'chore/bump-main-to-0.2.0-alpha');
});

test('next major is accepted', () => {
  const plan = planReleaseCut({ releaseVersion: '1.3.0', nextDevelopmentVersion: '2.0.0' });
  assert.deepEqual(plan.errors, []);
  assert.equal(plan.releaseBranch, 'release/v1.3');
});

test('skipping a minor is rejected', () => {
  const plan = planReleaseCut({ releaseVersion: '1.3.0', nextDevelopmentVersion: '1.5.0' });
  assert.equal(plan.errors.length, 1);
  assert.match(plan.errors[0], /neither the next minor .* nor the next major/);
});

test('a lower next version is rejected', () => {
  const plan = planReleaseCut({ releaseVersion: '1.3.0', nextDevelopmentVersion: '1.2.0' });
  assert.equal(plan.errors.length, 1);
});

test('non-semver inputs are rejected before any planning', () => {
  const plan = planReleaseCut({ releaseVersion: 'v1.3', nextDevelopmentVersion: '1.4' });
  assert.equal(plan.errors.length, 2);
  assert.equal(plan.releaseBranch, undefined);
});

test('a mismatched current development line is a warning, not an error', () => {
  const plan = planReleaseCut({
    releaseVersion: '0.1.0',
    nextDevelopmentVersion: '0.2.0',
    currentLine: '0.1.0-alpha.7',
  });
  assert.deepEqual(plan.errors, []);
  assert.equal(plan.warnings.length, 1);
});
