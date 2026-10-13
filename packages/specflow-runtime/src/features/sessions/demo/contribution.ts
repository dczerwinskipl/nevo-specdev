import type { DemoSpecification } from '../../demo-catalogue';
export interface SessionSummary {
  id: string;
  title: string;
  status: 'active' | 'attention' | 'quiet' | 'unknown';
  taskIds: string[];
}
export function buildDemoSessions(record: DemoSpecification): SessionSummary[] {
  if (!record.currentExecutions) return [];
  const sessions = new Map<string, SessionSummary>();
  for (const execution of record.currentExecutions) {
    sessions.set(execution.sessionId, {
      id: execution.sessionId,
      title: execution.agentRole + ' · ' + record.title,
      status: 'active',
      taskIds: [...execution.taskIds],
    });
  }
  for (const signal of record.signals ?? []) {
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
export function buildDemoSessionContribution(record: DemoSpecification) {
  const items = buildDemoSessions(record);
  const attention = (record.signals ?? []).flatMap((signal) =>
    signal.kind === 'attention' && signal.target.kind === 'session'
      ? [
          {
            id: signal.id,
            kind: 'session' as const,
            title: signal.label,
            reason: signal.reason ?? signal.label,
            targetId: signal.target.sessionId,
            priority: signal.attentionReason === 'input' ? ('high' as const) : ('normal' as const),
          },
        ]
      : [],
  );
  return {
    section: { state: 'available' as const, data: { items, attention } },
    recommendedSessionId: items[0]?.id,
  };
}
