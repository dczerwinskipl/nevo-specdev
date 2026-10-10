import type {
  WorkspaceReadModel,
  WorkspaceTaskRecord,
  WorkspaceSessionRecord,
  WorkspaceDocumentRecord,
  WorkspaceTaskDetailRecord,
} from '../workspace/repository';
import { createSampleSpecsOverviewRepository } from '../overview/repository/sample-repository';
import type { SpecsOverviewRepository } from '../overview/repository/read-repository';
import type { CurrentSpecRecord, ArchivedSpecRecord } from '../overview/repository/model';
import type { SpecificationWorkspaceRepository } from '../workspace/repository';

type DemoSpec = CurrentSpecRecord | ArchivedSpecRecord;
function isCurrent(record: DemoSpec): record is CurrentSpecRecord {
  return 'currentExecutions' in record;
}

function buildTasks(record: DemoSpec): WorkspaceTaskRecord[] {
  const activeIds = new Set(
    isCurrent(record) ? record.currentExecutions.flatMap((execution) => execution.taskIds) : [],
  );
  const completedIds = Array.from(
    { length: record.progress.total },
    (_, index) => 'TASK-' + String(index + 1).padStart(2, '0'),
  )
    .filter((id) => !activeIds.has(id))
    .slice(0, record.progress.completed);
  if (completedIds.length !== record.progress.completed) {
    throw new Error('Demo progress is incompatible with active executions.');
  }
  const completedSet = new Set(completedIds);
  return Array.from({ length: record.progress.total }, (_, index) => {
    const id = 'TASK-' + String(index + 1).padStart(2, '0');
    const completed = completedSet.has(id);
    const active = activeIds.has(id);
    return {
      id,
      title: id + ' · ' + record.title,
      status: {
        id: completed ? 'completed' : active ? 'in_progress' : 'ready',
        label: completed ? 'Completed' : active ? 'In progress' : 'Ready',
        lifecycle: completed
          ? ('completed' as const)
          : active
            ? ('in_progress' as const)
            : ('pending' as const),
      },
    };
  });
}

function buildSessions(record: DemoSpec): WorkspaceSessionRecord[] {
  if (!isCurrent(record)) return [];
  const sessions = new Map<string, WorkspaceSessionRecord>();
  for (const execution of record.currentExecutions) {
    sessions.set(execution.sessionId, {
      id: execution.sessionId,
      title: execution.agentRole + ' · ' + record.title,
      status: 'active',
      taskIds: [...execution.taskIds],
    });
  }
  for (const signal of record.signals) {
    if (signal.target.kind !== 'session') continue;
    const id = signal.target.sessionId;
    if (!sessions.has(id)) {
      sessions.set(id, {
        id,
        title: signal.label,
        status: signal.kind === 'attention' ? 'attention' : 'quiet',
        taskIds: [],
      });
    }
  }
  return [...sessions.values()];
}

function buildWorkspace(record: DemoSpec): WorkspaceReadModel {
  const tasks = buildTasks(record);
  const sessions = buildSessions(record);
  const attention = isCurrent(record)
    ? record.signals
        .filter((item) => item.kind === 'attention')
        .map((item) => ({
          id: item.id,
          kind:
            item.target.kind === 'session'
              ? ('session' as const)
              : item.target.kind === 'task'
                ? ('task' as const)
                : ('specification' as const),
          title: item.label,
          reason: item.reason ?? item.label,
          // The demo's explicit input reason is a fact about required human action,
          // not a UI inference from a generic Session kind.
          priority: item.attentionReason === 'input' ? ('high' as const) : ('normal' as const),
          ...(item.target.kind === 'session'
            ? { targetId: item.target.sessionId }
            : item.target.kind === 'task'
              ? { targetId: item.target.taskId }
              : {}),
        }))
    : [];
  const docs = [{ id: 'spec', title: 'Specification', kind: 'markdown', summary: record.title }];
  return {
    revision: 'demo-workspace-1',
    ...(sessions.length > 0 ? { recommendedSessionId: sessions[0]!.id } : {}),
    specification: {
      id: record.id,
      title: record.title,
      summary: record.title,
      preparationState:
        tasks.length === 0
          ? 'empty'
          : isCurrent(record) && !record.readyForWork
            ? 'preparing'
            : 'prepared',
      attention: attention.filter((item) => item.kind === 'specification'),
    },
    sections: {
      tasks: {
        state: 'available',
        data: {
          groups: tasks.length ? [{ id: 'tasks', name: 'Tasks', tasks }] : [],
          completed: record.progress.completed,
          total: record.progress.total,
          attention: attention.filter((item) => item.kind === 'task'),
        },
      },
      documents: { state: 'available', data: { items: docs } },
      sessions: {
        state: 'available',
        data: { items: sessions, attention: attention.filter((item) => item.kind === 'session') },
      },
      activity: { state: 'available', data: { items: [] } },
      repository: { state: 'unavailable', reason: 'not_implemented' },
      changes: { state: 'unavailable', reason: 'not_implemented' },
    },
    actions: {
      executeTasks: { available: false, reason: 'not_implemented' },
      startSession: { available: false, reason: 'not_implemented' },
    },
  };
}

export function createDemoSpecsRepositories(): {
  overviewRepository: SpecsOverviewRepository;
  workspaceRepository: SpecificationWorkspaceRepository;
} {
  const overviewRepository = createSampleSpecsOverviewRepository();

  async function find(specId: string): Promise<DemoSpec | undefined> {
    const [current, archive] = await Promise.all([
      overviewRepository.readCurrent(),
      overviewRepository.readArchive(),
    ]);
    return [...current.items, ...archive.items].find((spec) => spec.id === specId);
  }

  return {
    overviewRepository,
    workspaceRepository: {
      async readWorkspace(specId) {
        const record = await find(specId);
        return record ? buildWorkspace(record) : null;
      },
      async readDocument(specId, documentId): Promise<WorkspaceDocumentRecord | null> {
        const record = await find(specId);
        if (!record || documentId !== 'spec') return null;
        return {
          id: 'spec',
          title: 'Specification',
          content: '# ' + record.title + '\n\nDemonstration Specification for ' + record.id + '.',
          revision: 'demo-document-1',
        };
      },
      async readTask(specId, taskId): Promise<WorkspaceTaskDetailRecord | null> {
        const record = await find(specId);
        const task = record && buildTasks(record).find((item) => item.id === taskId);
        return task
          ? { task, purpose: 'Demonstration Task for ' + record.title, acceptanceCriteria: [] }
          : null;
      },
    },
  };
}
