// BLOCKER #5 — the PR-review decision must never fail open.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { decidePrReviewPolicy } from './policy.mjs';

const target = {
  required_approving_review_count: 1,
  dismiss_stale_reviews_on_push: true,
  require_last_push_approval: true,
  required_review_thread_resolution: true,
};

test('two verified eligible reviewers -> durable target, no exception', () => {
  const d = decidePrReviewPolicy({
    target,
    discovery: { ok: true, eligible: ['alice', 'bob'] },
  });
  assert.equal(d.kind, 'target');
  assert.equal(d.params.required_approving_review_count, 1);
  assert.equal(d.params.require_last_push_approval, true);
  assert.equal(d.exception, null);
});

test('one verified eligible reviewer -> bootstrap 0-approval exception, reported', () => {
  const d = decidePrReviewPolicy({
    target,
    discovery: { ok: true, eligible: ['alice'] },
  });
  assert.equal(d.kind, 'bootstrap');
  assert.equal(d.params.required_approving_review_count, 0);
  assert.equal(d.params.require_last_push_approval, false);
  assert.match(d.exception, /only 1 eligible reviewer \(alice\)/);
});

test('zero verified eligible reviewers -> bootstrap exception (API was readable)', () => {
  const d = decidePrReviewPolicy({ target, discovery: { ok: true, eligible: [] } });
  assert.equal(d.kind, 'bootstrap');
  assert.equal(d.params.required_approving_review_count, 0);
  assert.match(d.exception, /only 0 eligible reviewers \(\(none\)\)/);
});

test('collaborator lookup failure -> unverifiable, NO policy mutation', () => {
  const d = decidePrReviewPolicy({
    target,
    discovery: { ok: false, reason: 'HTTP 403: Resource not accessible by integration' },
  });
  assert.equal(d.kind, 'unverifiable');
  assert.equal(d.params, undefined); // nothing to apply
  assert.match(d.reason, /could not determine reviewer eligibility/);
  assert.match(d.reason, /403/);
  assert.match(d.reason, /only applied when the API is readable/);
});

test('the target object is never mutated by a bootstrap decision', () => {
  const snapshot = JSON.parse(JSON.stringify(target));
  decidePrReviewPolicy({ target, discovery: { ok: true, eligible: [] } });
  assert.deepEqual(target, snapshot);
});
