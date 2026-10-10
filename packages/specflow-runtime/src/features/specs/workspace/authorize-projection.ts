import type { SpecificationWorkspaceResponse } from '@nevo/specflow-contracts/specs/workspace';
/**
 * A single policy for all Session references. Sources must mark generic
 * Session-owned activity with relatedSessionId; unbound Session events are dropped.
 */
export function authorizeSessionReferences(
  data: SpecificationWorkspaceResponse,
  canReadSession: (sessionId: string) => boolean,
): SpecificationWorkspaceResponse {
  const sections = data.sections;
  const sessions = sections.sessions;
  const sourceSessions = sessions.state === 'available' ? sessions.data.items : [];
  const permitted = sourceSessions.filter((item) => canReadSession(item.id));
  const visibleSessionIds = new Set(permitted.map((item) => item.id));
  const isAllowed = (id: string | undefined) => id !== undefined && canReadSession(id);
  // Session-targeted Attention can arrive through any domain-owned section.
  // Authorization must follow the referenced resource, not the section container.
  const visibleAttention = <T extends { kind: string; targetId?: string }>(items: readonly T[]) =>
    items.filter((item) => item.kind !== 'session' || isAllowed(item.targetId));
  const activity = sections.activity;
  return {
    ...data,
    ...(data.recommendedSessionId && visibleSessionIds.has(data.recommendedSessionId)
      ? { recommendedSessionId: data.recommendedSessionId }
      : { recommendedSessionId: undefined }),
    specification: {
      ...data.specification,
      attention: visibleAttention(data.specification.attention),
    },
    sections: {
      ...sections,
      tasks:
        sections.tasks.state === 'available'
          ? {
              state: 'available',
              data: {
                ...sections.tasks.data,
                attention: visibleAttention(sections.tasks.data.attention),
              },
            }
          : sections.tasks,
      repository:
        sections.repository.state === 'available'
          ? {
              state: 'available',
              data: {
                ...sections.repository.data,
                attention: visibleAttention(sections.repository.data.attention),
              },
            }
          : sections.repository,
      sessions:
        sessions.state !== 'available'
          ? sessions
          : permitted.length === 0 && sourceSessions.length > 0
            ? { state: 'forbidden' }
            : {
                state: 'available',
                data: {
                  ...sessions.data,
                  items: permitted,
                  attention: visibleAttention(sessions.data.attention),
                },
              },
      activity:
        activity.state === 'available'
          ? {
              state: 'available',
              data: {
                items: activity.data.items.filter((item) =>
                  item.kind === 'session'
                    ? isAllowed(item.targetId) &&
                      (!item.relatedSessionId || isAllowed(item.relatedSessionId))
                    : !item.relatedSessionId || isAllowed(item.relatedSessionId),
                ),
              },
            }
          : activity,
    },
  };
}
