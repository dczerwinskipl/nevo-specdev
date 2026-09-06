import { describe, expect, it } from 'vitest';

import { decidePrReviewPolicy, parsePolicy, stripMeta } from '../../src/domain/policy.js';
import { UsageError } from '../../src/errors.js';

const target = {
  required_approving_review_count: 1,
  dismiss_stale_reviews_on_push: true,
  require_last_push_approval: true,
  required_review_thread_resolution: true,
};

describe('stripMeta / parsePolicy', () => {
  it('drops $-prefixed keys and validates the shape', () => {
    expect(stripMeta({ $comment: 'x', a: 1 })).toEqual({ a: 1 });
    expect(() => parsePolicy('{ not json')).toThrow(UsageError);
    expect(() => parsePolicy('{"merge":{}}')).toThrow(/rulesets/);
  });
});

describe('decidePrReviewPolicy — never fail open', () => {
  it('two verified eligible reviewers -> durable target', () => {
    const d = decidePrReviewPolicy({ target, discovery: { ok: true, eligible: ['a', 'b'] } });
    expect(d.kind).toBe('target');
    if (d.kind !== 'unverifiable') {
      expect(d.params.required_approving_review_count).toBe(1);
    }
  });

  it('one verified -> bootstrap 0-approval exception, reported', () => {
    const d = decidePrReviewPolicy({ target, discovery: { ok: true, eligible: ['alice'] } });
    expect(d.kind).toBe('bootstrap');
    if (d.kind === 'bootstrap') {
      expect(d.params.required_approving_review_count).toBe(0);
      expect(d.params.require_last_push_approval).toBe(false);
      expect(d.exception).toMatch(/only 1 eligible reviewer \(alice\)/);
    }
  });

  it('zero verified -> bootstrap (the API WAS readable)', () => {
    const d = decidePrReviewPolicy({ target, discovery: { ok: true, eligible: [] } });
    expect(d.kind).toBe('bootstrap');
  });

  it('collaborator lookup failure -> unverifiable, no params to apply', () => {
    const d = decidePrReviewPolicy({
      target,
      discovery: { ok: false, reason: 'HTTP 403' },
    });
    expect(d.kind).toBe('unverifiable');
    expect(d).not.toHaveProperty('params');
    if (d.kind === 'unverifiable') {
      expect(d.reason).toMatch(/403/);
      expect(d.reason).toMatch(/only applied when the API is readable/);
    }
  });

  it('never mutates the target object', () => {
    const snapshot = JSON.parse(JSON.stringify(target)) as typeof target;
    decidePrReviewPolicy({ target, discovery: { ok: true, eligible: [] } });
    expect(target).toEqual(snapshot);
  });
});
