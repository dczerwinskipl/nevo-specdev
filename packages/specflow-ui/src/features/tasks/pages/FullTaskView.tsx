import type { ReactNode } from 'react';
import type { FullTaskData } from '../model';
import { TaskDetails } from '../detail/TaskDetails';
export interface FullTaskViewProps {
  readonly task: FullTaskData;
  readonly specKey: string;
  readonly onBack: () => void;
  readonly backHref?: string;
  readonly onOpenSession?: (sessionId: string) => void;
  readonly children?: ReactNode;
}
export function FullTaskView({ task, specKey, children }: FullTaskViewProps) {
  return (
    <div className="grid min-w-0 max-w-content-standard gap-4">
      {children ?? <TaskDetails task={task} specKey={specKey} />}
    </div>
  );
}
