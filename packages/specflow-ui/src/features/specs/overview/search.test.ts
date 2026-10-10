import { describe, expect, it } from 'vitest';

import { createSpecsFixture } from '../../../../test-support/specs/overview/fixtures';
import { filterSpecsOverview } from './search';

describe('one authoritative Overview search view', () => {
  it.each(['current', 'archive'] as const)(
    'filters %s titles with normalized matching and preserves the source',
    (collection) => {
      const source = createSpecsFixture(collection);
      const originalCount = source.items.length;
      const title = source.items[0]!.title;
      const result = filterSpecsOverview(source, `  ${title.toUpperCase()}  `);

      expect(result.items.length).toBeGreaterThan(0);
      expect(
        result.items.every((item) => item.title.toLowerCase().includes(title.toLowerCase())),
      ).toBe(true);
      expect(result.collection).toBe(collection);
      expect(source.items).toHaveLength(originalCount);
      expect(filterSpecsOverview(source, 'unmatched phrase').items).toEqual([]);
      expect(filterSpecsOverview(source, '   ')).toBe(source);
    },
  );
});
