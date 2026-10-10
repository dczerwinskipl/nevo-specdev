import type { TFunction } from 'i18next';
import type { TaskItem } from './model';

const TASK_STATUS_KEYS = {
  pending: 'specification.taskStatusPending',
  in_progress: 'specification.taskStatusInProgress',
  completed: 'specification.taskStatusCompleted',
  blocked: 'specification.taskStatusBlocked',
} as const;

/** Resolve at render time, never when producing a TanStack Query cache entry. */
export function taskStatusLabel(
  task: Pick<TaskItem, 'status' | 'statusCode'>,
  t: TFunction,
): string {
  return task.statusCode ? t(TASK_STATUS_KEYS[task.statusCode]) : task.status;
}
