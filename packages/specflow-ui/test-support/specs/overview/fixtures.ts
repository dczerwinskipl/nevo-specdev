import type {
  ArchivedSpecOverviewItem,
  ArchiveSpecsOverview,
  CurrentSpecOverviewItem,
  CurrentSpecsOverview,
  CurrentSpecSignal,
  CurrentSpecSignalKind,
  CurrentSpecTarget,
  SpecsCollection,
  SpecsOverview,
} from '../../../src/features/specs/overview/model';

const specTarget = (specId: string): CurrentSpecTarget => ({ kind: 'specification', specId });

function signal(
  specId: string,
  id: string,
  kind: CurrentSpecSignalKind,
  label: string,
  priority: number,
  target: CurrentSpecTarget = specTarget(specId),
  reason?: string,
  attentionReason?: CurrentSpecSignal['attentionReason'],
  count?: number,
): CurrentSpecSignal {
  return {
    id,
    kind,
    label,
    priority,
    target,
    ...(reason ? { reason } : {}),
    ...(attentionReason ? { attentionReason } : {}),
    ...(count ? { count } : {}),
  };
}

export function createSpecItem(
  overrides: Partial<CurrentSpecOverviewItem> = {},
): CurrentSpecOverviewItem {
  return {
    id: 'admission',
    title: 'Deterministic admission and execution boundaries',
    classification: { section: 'draft' },
    updatedAt: '2026-10-01T12:00:00Z',
    progress: { completed: 5, total: 9 },
    signals: [],
    currentExecutions: [],
    ...overrides,
  };
}

export function createArchiveItem(
  overrides: Partial<ArchivedSpecOverviewItem> = {},
): ArchivedSpecOverviewItem {
  return {
    id: 'archive-spec',
    key: 'UI-1200',
    tags: ['UI', 'Workspace'],
    pullRequests: [{ number: 18, url: 'https://example.test/pull/18' }],
    title: 'Archived specification',
    updatedAt: '2026-10-01T12:00:00Z',
    progress: { completed: 5, total: 9 },
    ...overrides,
  };
}

export function createSpecsFixture(collection?: 'current'): CurrentSpecsOverview;
export function createSpecsFixture(collection: 'archive'): ArchiveSpecsOverview;
export function createSpecsFixture(collection: SpecsCollection): SpecsOverview;
export function createSpecsFixture(collection: SpecsCollection = 'current'): SpecsOverview {
  if (collection === 'archive') {
    return {
      revision: 'archive-fixture-1',
      collection,
      items: Array.from({ length: 18 }, (_, index) =>
        createArchiveItem({
          id: `archive-${index}`,
          key: `${['UI', 'RT', 'CORE'][index % 3]}-${1200 + index}`,
          tags: [
            ['UI', 'Workspace'],
            ['Runtime', 'Security'],
            ['Core', 'Delivery'],
          ][index % 3],
          pullRequests: [{ number: 18 + index, url: `https://example.test/pull/${18 + index}` }],
          title:
            [
              'Canonical Session, Turn and Work model',
              'Repository authentication and trusted local access',
              'Responsive application shell and workspace navigation',
            ][index % 3] + (index > 2 ? ` — phase ${index + 1}` : ''),
          updatedAt: `2026-09-${String(28 - index).padStart(2, '0')}T12:00:00Z`,
          ...(index % 4 === 0
            ? { completedAt: '2026-09-22T14:00:00Z' }
            : index % 4 === 1
              ? { archivedAt: '2026-09-25T09:00:00Z' }
              : index % 4 === 2
                ? {
                    completedAt: '2026-09-22T14:00:00Z',
                    archivedAt: '2026-09-25T09:00:00Z',
                  }
                : {}),
          progress: { completed: 8 + index, total: 8 + index },
        }),
      ),
    };
  }

  return {
    revision: 'current-fixture-1',
    collection,
    sections: ['requires-attention', 'active', 'ready', 'draft'],
    items: [
      createSpecItem({
        key: 'UI-1234',
        classification: { section: 'requires-attention', reason: 'input' },
        pullRequests: [{ number: 27, url: 'https://example.test/pull/27' }],
        tags: ['Auth'],
        signals: [
          signal(
            'admission',
            'input',
            'attention',
            'Agent asks for input',
            110,
            { kind: 'session', specId: 'admission', sessionId: 'session-23' },
            'Choose how queued work should behave after a recovery.',
            'input',
          ),
          signal('admission', 'review', 'attention', 'TASK-03 requires review', 100, {
            kind: 'task',
            specId: 'admission',
            taskId: 'TASK-03',
          }),
          signal('admission', 'ready', 'ready', 'TASK-05 ready to start', 60, {
            kind: 'task',
            specId: 'admission',
            taskId: 'TASK-05',
          }),
          signal('admission', 'working', 'working', 'Reviewer working', 40),
        ],
        currentExecutions: [
          { sessionId: 'session-23', agentRole: 'Reviewer', taskIds: ['TASK-02', 'TASK-03'] },
        ],
      }),
      createSpecItem({
        id: 'security',
        classification: { section: 'requires-attention', reason: 'decision' },
        key: 'RT-1235',
        tags: ['Runtime'],
        title: 'Runtime authorization and project access policy',
        progress: { completed: 3, total: 7 },
        signals: [
          signal(
            'security',
            'owner',
            'attention',
            'Owner decision required',
            100,
            specTarget('security'),
            'Confirm which project operations reviewers can access.',
            'decision',
          ),
        ],
      }),
      createSpecItem({
        id: 'review',
        classification: { section: 'requires-attention', reason: 'review', count: 3 },
        key: 'CORE-1236',
        title: 'Review evidence and verification handover',
        progress: { completed: 6, total: 10 },
        signals: [
          signal(
            'review',
            'aggregate',
            'attention',
            '3 Tasks require review',
            95,
            specTarget('review'),
            undefined,
            'review',
            3,
          ),
        ],
      }),
      createSpecItem({
        id: 'packaging',
        classification: { section: 'ready' },
        key: 'CORE-1237',
        tags: ['Core'],
        title: 'Single-artifact packaging and installation',
        progress: { completed: 4, total: 6 },
        signals: [signal('packaging', 'ready', 'ready', '2 Tasks ready to start', 60)],
      }),
      createSpecItem({
        id: 'providers',
        classification: { section: 'active' },
        key: 'RT-104',
        pullRequests: [{ number: 31, url: 'https://example.test/pull/31' }],
        tags: ['Provider'],
        title: 'Provider diagnostics and replay',
        progress: { completed: 2, total: 8 },
        signals: [signal('providers', 'batch', 'working', 'Implementation in progress', 40)],
        currentExecutions: [
          {
            sessionId: 'session-42',
            agentRole: 'Implementer',
            taskIds: ['TASK-02', 'TASK-04', 'TASK-05'],
          },
        ],
      }),
      createSpecItem({
        id: 'recovery',
        classification: { section: 'ready' },
        key: 'RT-105',
        tags: ['Provider'],
        title: 'Provider process recovery',
        progress: { completed: 1, total: 4 },
        signals: [
          signal(
            'recovery',
            'issue',
            'issue',
            'Agent remediation available',
            30,
            specTarget('recovery'),
            'The agent can retry the failed verification.',
          ),
        ],
      }),
      createSpecItem({
        id: 'localization',
        classification: { section: 'draft' },
        key: 'UI-1238',
        tags: ['UI'],
        title: 'Localization and account preferences',
        progress: { completed: 0, total: 5 },
        signals: [signal('localization', 'quiet', 'quiet', 'No immediate action', 10)],
      }),
    ],
  };
}

export function createLongContentFixture(): CurrentSpecsOverview {
  const base = createSpecsFixture();
  return {
    ...base,
    items: [
      createSpecItem({
        ...base.items[0],
        title:
          'Deterministic execution admission, crash recovery and cross-provider ownership reconciliation for distributed repository workspaces',
        classification: { section: 'requires-attention', reason: 'decision' },
        signals: [
          signal(
            'admission',
            'long',
            'attention',
            'TASK-03 requires an owner decision about recovery after a provider disconnects during verification',
            110,
            { kind: 'task', specId: 'admission', taskId: 'TASK-03' },
            'Confirm whether verification should continue in the existing worktree or resume after the upstream repository changes have been reconciled.',
            'decision',
          ),
          ...base.items[0]!.signals,
        ],
      }),
      ...base.items.slice(1),
    ],
  };
}
