import { describe, expect, it } from 'vitest';

import { createArchiveItem, createSpecItem, createSpecsFixture } from './fixtures';
import { sectionTranslationKey } from './model';
import { archiveRow, currentRow } from './presentation';

describe('Specs Overview presentation boundary', () => {
  it('derives row summary and concurrent qualifier from the simplified Current model', () => {
    const source = createSpecsFixture().items[0]!;
    const row = currentRow(source);

    expect(row.sectionId).toBe('requires-attention');
    expect(row.summary).toEqual({ kind: 'attention', reason: 'input' });
    expect(row.qualifier).toEqual({ executionCount: 1 });
    expect(row).not.toHaveProperty('signals');
    expect(row).not.toHaveProperty('currentExecutions');
    expect(JSON.stringify(row)).not.toContain('TASK-');

    expect(
      currentRow({
        ...source,
        classification: { section: 'draft' },
        currentExecutions: [],
      }).sectionId,
    ).toBe('draft');
  });

  it('keeps unknown status and progress explicit in the presentation model', () => {
    const row = currentRow(
      createSpecItem({
        classification: { section: 'unknown' },
        progress: null,
        signals: null,
        currentExecutions: null,
      }),
    );
    expect(row.progress).toBeNull();
    expect(row.sectionId).toBe('unknown');
    expect(row.summary).toEqual({ kind: 'unknown' });
    expect(row.qualifier).toBeUndefined();
  });

  it('preserves Requires attention when its semantic reason is not classified yet', () => {
    expect(
      currentRow(
        createSpecItem({
          classification: { section: 'requires-attention' },
        }),
      ).summary,
    ).toEqual({ kind: 'attention' });
  });

  it('maps stable Current section IDs to frontend-owned translations', () => {
    expect(sectionTranslationKey).toEqual({
      'requires-attention': 'specifications.sections.requiresAttention',
      active: 'specifications.sections.active',
      ready: 'specifications.sections.ready',
      draft: 'specifications.sections.draft',
      unknown: 'specifications.sections.unknown',
    });
  });

  it('derives Active execution count from current executions instead of duplicated backend data', () => {
    const row = currentRow(
      createSpecItem({
        classification: { section: 'active' },
        currentExecutions: [
          { sessionId: 'one', agentRole: 'Implementer', taskIds: ['TASK-1'] },
          { sessionId: 'two', agentRole: 'Reviewer', taskIds: ['TASK-2'] },
        ],
      }),
    );

    expect(row.summary).toEqual({ kind: 'active', executionCount: 2 });
    expect(row.qualifier).toBeUndefined();
  });

  it('links exactly one PR but never chooses a representative for several', () => {
    const single = currentRow(createSpecsFixture().items[0]!);
    expect(single.pullRequests).toEqual({
      kind: 'single',
      number: 27,
      href: 'https://example.test/pull/27',
    });

    const multiple = currentRow(
      createSpecItem({
        pullRequests: [1, 2, 3].map((number) => ({
          number,
          url: `https://example.test/${number}`,
        })),
        tags: ['one', 'two', 'three'],
      }),
    );

    expect(multiple.pullRequests).toEqual({ kind: 'multiple', count: 3 });
    expect(multiple.tags).toEqual(['one', 'two']);
    expect(multiple.omittedTags).toBe(1);
  });

  it.each([
    [
      { completedAt: '2026-09-22T14:00:00Z' },
      { kind: 'completed', timestamp: '2026-09-22T14:00:00Z' },
    ],
    [
      { archivedAt: '2026-09-25T09:00:00Z' },
      { kind: 'archived', timestamp: '2026-09-25T09:00:00Z' },
    ],
    [
      { completedAt: '2026-09-22T14:00:00Z', archivedAt: '2026-09-25T09:00:00Z' },
      { kind: 'completed', timestamp: '2026-09-22T14:00:00Z' },
    ],
    [{}, { kind: 'archived', timestamp: undefined }],
  ])('uses only authoritative Archive lifecycle data: %j', (timestamps, history) => {
    const row = archiveRow(createArchiveItem({ ...timestamps, updatedAt: '2099-01-01T00:00:00Z' }));

    expect(row.history).toEqual(history);
    expect(row).not.toHaveProperty('summary');
    expect(row).not.toHaveProperty('sectionId');
    expect(JSON.stringify(row)).not.toContain('2099');
  });
});
