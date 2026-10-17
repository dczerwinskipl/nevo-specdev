import { Value } from 'typebox/value';
import { describe, expect, it } from 'vitest';

import { SpecsOverviewSchema } from './index';

const baseItem = {
  id: 'spec',
  title: 'Specification',
  updatedAt: '2026-10-01T12:00:00Z',
  progress: { completed: 2, total: 3 },
};

describe('Specs Overview contracts', () => {
  it('keeps Archive free from Current-only section and steering fields', () => {
    const archive = {
      collection: 'archive',
      revision: '1',
      items: [{ ...baseItem, completedAt: '2026-09-01T12:00:00Z' }],
    };

    expect(Value.Check(SpecsOverviewSchema, archive)).toBe(true);
    expect(Value.Check(SpecsOverviewSchema, { ...archive, sections: [] })).toBe(false);
    expect(
      Value.Check(SpecsOverviewSchema, {
        ...archive,
        items: [{ ...baseItem, classification: { section: 'ready' } }],
      }),
    ).toBe(false);
  });

  it('requires an explicit Current classification and ordered section list', () => {
    expect(
      Value.Check(SpecsOverviewSchema, {
        collection: 'current',
        revision: '1',
        sections: ['requires-attention', 'active', 'ready', 'draft'],
        items: [
          {
            ...baseItem,
            classification: { section: 'draft' },
            signals: [],
            currentExecutions: [],
          },
        ],
      }),
    ).toBe(true);
  });

  it('accepts explicitly unknown progress, signals and session evidence', () => {
    expect(
      Value.Check(SpecsOverviewSchema, {
        collection: 'current',
        revision: 'unknown',
        sections: ['unknown'],
        items: [
          {
            ...baseItem,
            progress: null,
            classification: { section: 'unknown' },
            signals: null,
            currentExecutions: null,
          },
        ],
      }),
    ).toBe(true);
  });

  it('allows Requires attention before a semantic attention reason is classified', () => {
    expect(
      Value.Check(SpecsOverviewSchema, {
        collection: 'current',
        revision: '1',
        sections: ['requires-attention'],
        items: [
          {
            ...baseItem,
            classification: { section: 'requires-attention' },
            signals: [
              {
                id: 'attention',
                kind: 'attention',
                label: 'Human attention required',
                priority: 1,
                target: { kind: 'specification', specId: 'spec' },
              },
            ],
            currentExecutions: [],
          },
        ],
      }),
    ).toBe(true);
  });
});
