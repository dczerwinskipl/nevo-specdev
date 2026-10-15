import { describe, expect, it } from 'vitest';
import { pickerEntries } from './pickerEntries';
import { createSpecsFixture } from '../../../test-support/specs/overview/fixtures';
describe('Specification picker projection', () => {
  const items = createSpecsFixture().items;
  it('puts the permitted current identity first and bounds other entries without inventing recency', () => {
    expect(pickerEntries(items, { ...items[6]! }, '').map((item) => item.id)).toEqual([
      items[6]!.id,
      ...items.slice(0, 5).map((item) => item.id),
    ]);
  });
  it('matches title and display key, preserves source order and filters an independently supplied identity', () => {
    expect(
      pickerEntries(
        items,
        { id: 'independent', title: 'Hidden context', key: 'UI-9999' },
        'ui-9999',
      ).map((item) => item.id),
    ).toEqual(['independent']);
    expect(pickerEntries(items, { id: 'independent', title: 'Hidden context' }, 'REVIEW')).toEqual([
      items.find((item) => item.title.toLowerCase().includes('review')),
    ]);
    expect(pickerEntries(items, undefined, 'does-not-exist')).toEqual([]);
  });
});
