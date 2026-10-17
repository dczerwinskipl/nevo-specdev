import { describe, expect, it } from 'vitest';

import type { CurrentSpecRecord } from '../repository/model';
import { classifyCurrentSpec } from './classify-spec';

function spec(overrides: Partial<CurrentSpecRecord> = {}): CurrentSpecRecord {
  return {
    id: 'spec',
    title: 'Spec',
    updatedAt: '2026-10-01T12:00:00Z',
    progress: { completed: 0, total: 1 },
    readyForWork: false,
    signals: [],
    currentExecutions: [],
    ...overrides,
  };
}

describe('Current Specs Overview classification', () => {
  it('prioritizes the highest-priority attention signal over active execution', () => {
    expect(
      classifyCurrentSpec(
        spec({
          readyForWork: true,
          signals: [
            {
              id: 'review',
              kind: 'attention',
              label: 'Review',
              attentionReason: 'review',
              priority: 10,
              target: { kind: 'specification', specId: 'spec' },
            },
            {
              id: 'decision',
              kind: 'attention',
              label: 'Decision',
              attentionReason: 'decision',
              count: 2,
              priority: 20,
              target: { kind: 'specification', specId: 'spec' },
            },
          ],
          currentExecutions: [
            { sessionId: 'session', agentRole: 'Implementer', taskIds: ['TASK-1'] },
          ],
        }),
      ),
    ).toEqual({ section: 'requires-attention', reason: 'decision', count: 2 });
  });

  it('keeps human attention dominant even when its semantic reason is not classified yet', () => {
    expect(
      classifyCurrentSpec(
        spec({
          readyForWork: true,
          signals: [
            {
              id: 'unknown-attention',
              kind: 'attention',
              label: 'Human input required',
              priority: 30,
              target: { kind: 'specification', specId: 'spec' },
            },
          ],
          currentExecutions: [
            { sessionId: 'session', agentRole: 'Implementer', taskIds: ['TASK-1'] },
          ],
        }),
      ),
    ).toEqual({ section: 'requires-attention' });
  });

  it('classifies execution as active when no attention requires the human', () => {
    expect(
      classifyCurrentSpec(
        spec({
          readyForWork: true,
          currentExecutions: [
            { sessionId: 'session', agentRole: 'Implementer', taskIds: ['TASK-1'] },
          ],
        }),
      ),
    ).toEqual({ section: 'active' });
  });

  it('does not interpret unknown execution evidence as draft or ready', () => {
    expect(
      classifyCurrentSpec(spec({ readyForWork: null, signals: null, currentExecutions: null })),
    ).toEqual({ section: 'unknown' });
    expect(classifyCurrentSpec(spec({ currentExecutions: null }))).toEqual({ section: 'unknown' });
  });

  it.each([
    [true, 'ready'],
    [false, 'draft'],
  ] as const)(
    'falls back to readyForWork=%s as %s when no stronger state exists',
    (readyForWork, section) => {
      expect(classifyCurrentSpec(spec({ readyForWork }))).toEqual({ section });
    },
  );
});
