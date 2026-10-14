import type {
  SpecificationWorkspaceResponse,
  WorkspaceAttention,
} from '@nevo/specflow-contracts/specs/workspace';
import type {
  ActivityEvent,
  AttentionItem,
  FeatureAttentionSource,
  SpecificationWorkspaceData,
  TaskItem,
} from './model';

function mapAttention(items: readonly WorkspaceAttention[]): AttentionItem[] {
  return items.map((item) => ({
    id: item.id,
    kind: item.kind,
    title: item.title,
    reason: item.reason,
    actionLabel: '',
    actionCode: item.kind,
    targetId: item.targetId,
    priority: item.priority,
  }));
}

function mapFeatureAttention(
  section: SpecificationWorkspaceResponse['sections']['tasks' | 'sessions' | 'repository'],
): FeatureAttentionSource {
  return section.state === 'available'
    ? { state: 'available', items: mapAttention(section.data.attention) }
    : section.state === 'unavailable'
      ? { state: 'unavailable', reason: section.reason }
      : { state: 'forbidden' };
}

export function mapWorkspaceResponse(
  dto: SpecificationWorkspaceResponse,
): SpecificationWorkspaceData {
  const { sections, specification } = dto;
  const tasks = sections.tasks.state === 'available' ? sections.tasks.data : undefined;
  const sessions = sections.sessions.state === 'available' ? sections.sessions.data.items : [];
  const taskGroups = (tasks?.groups ?? []).map((group) => ({
    id: group.id,
    name: group.name,
    tasks: group.tasks.map((task): TaskItem => ({
      id: task.id,
      title: task.title,
      status: task.status.lifecycle,
      statusCode: task.status.lifecycle,
      lifecycle: task.status.lifecycle,
      group: group.id,
    })),
  }));
  const sessionSummaries = sessions.map((session) => ({
    id: session.id,
    title: session.title,
    navigationStatus: session.status,
    taskCount: session.taskIds.length > 0 ? String(session.taskIds.length) : undefined,
    activityCode:
      session.status === 'active' || session.status === 'attention' ? session.status : undefined,
    activity:
      session.status === 'active'
        ? { label: '', tone: 'info' as const, icon: 'loader' as const, animate: true }
        : session.status === 'attention'
          ? {
              label: '',
              tone: 'attention' as const,
              icon: 'triangle-alert' as const,
            }
          : undefined,
  }));
  const repository =
    sections.repository.state === 'available' ? sections.repository.data : undefined;
  const changes = sections.changes.state === 'available' ? sections.changes.data : undefined;
  return {
    id: specification.id,
    title: specification.title,
    intro: specification.summary,
    isEmpty: specification.preparationState === 'empty',
    isPreparing: specification.preparationState === 'preparing',
    // A temporarily unavailable repository is unknown, not absent.
    // Forbidden or not-yet-implemented Git is not a usable navigation target.
    hasGit:
      sections.repository.state === 'available'
        ? true
        : sections.repository.state === 'forbidden' ||
            sections.repository.reason === 'not_implemented'
          ? false
          : undefined,
    sectionAvailability: {
      tasks: sections.tasks.state,
      documents: sections.documents.state,
      sessions: sections.sessions.state,
      activity: sections.activity.state,
      repository: sections.repository.state,
      changes: sections.changes.state,
    },
    attentionItems: mapAttention(specification.attention),
    featureAttention: {
      tasks: mapFeatureAttention(sections.tasks),
      sessions: mapFeatureAttention(sections.sessions),
      git: mapFeatureAttention(sections.repository),
    },
    taskGroups,
    completedTasksCount: tasks?.completed,
    totalTasksCount: tasks?.total,
    documents:
      sections.documents.state === 'available'
        ? sections.documents.data.items.map((doc) => ({
            id: doc.id,
            title: doc.title,
            kind: doc.kind,
            summary: doc.summary,
          }))
        : [],
    mainDocumentId:
      sections.documents.state === 'available' ? sections.documents.data.items[0]?.id : undefined,
    sessions: sessionSummaries,
    resumeSession: sessionSummaries.find((session) => session.id === dto.recommendedSessionId),
    activityEvents:
      sections.activity.state === 'available'
        ? sections.activity.data.items.flatMap((event): ActivityEvent[] => {
            const core = {
              id: event.id,
              time: event.occurredAt,
              title: event.title,
              description: event.description,
            };
            if (event.kind === 'info') {
              return [
                { ...core, kind: 'info', ...(event.targetId ? { targetId: event.targetId } : {}) },
              ];
            }
            if (!event.targetId) return [];
            return [{ ...core, kind: event.kind, targetId: event.targetId }];
          })
        : [],
    repoContext: repository,
    changes,
    executionReadiness: {
      canExecute: dto.actions.executeTasks.available,
      reasonCode: dto.actions.executeTasks.reason,
      blockers: [],
    },
  };
}
