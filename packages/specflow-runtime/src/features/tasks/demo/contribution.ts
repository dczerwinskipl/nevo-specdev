import type { DemoSpecification } from '../../demo-catalogue';
import { buildDemoTasks } from './sources';
export function buildDemoTaskContribution(record: DemoSpecification) {
  const tasks = buildDemoTasks(record);
  const attention = (record.signals ?? []).flatMap((signal) =>
    signal.kind === 'attention' && signal.target.kind === 'task'
      ? [
          {
            id: signal.id,
            kind: 'task' as const,
            title: signal.label,
            reason: signal.reason ?? signal.label,
            targetId: signal.target.taskId,
            priority: signal.attentionReason === 'input' ? ('high' as const) : ('normal' as const),
          },
        ]
      : [],
  );
  return {
    state: 'available' as const,
    data: {
      groups: tasks.length ? [{ id: 'tasks', name: 'Tasks', tasks }] : [],
      completed: record.progress.completed,
      total: record.progress.total,
      attention,
    },
  };
}
