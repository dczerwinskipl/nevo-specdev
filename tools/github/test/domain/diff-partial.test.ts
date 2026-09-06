import { describe, expect, it } from 'vitest';

import { diffPartial } from '../../src/domain/diff-partial.js';

describe('diffPartial', () => {
  it('is satisfied when actual is a superset of expected', () => {
    expect(diffPartial({ a: 1 }, { a: 1, b: 2 })).toEqual([]);
    expect(diffPartial({ a: { x: true } }, { a: { x: true, y: 9 } })).toEqual([]);
  });

  it('reports scalar, shape and array-length mismatches with a path', () => {
    expect(diffPartial({ a: 1 }, { a: 2 }).join()).toMatch(/a: expected 1, got 2/);
    expect(diffPartial({ a: { x: 1 } }, { a: 5 }).join()).toMatch(/a: expected object/);
    expect(diffPartial([1, 2], [1]).join()).toMatch(/expected array of 2/);
  });

  it('recurses into array elements', () => {
    expect(diffPartial([{ t: 'a' }], [{ t: 'b' }]).join()).toMatch(
      /\[0\]\.t: expected "a", got "b"/,
    );
  });
});
