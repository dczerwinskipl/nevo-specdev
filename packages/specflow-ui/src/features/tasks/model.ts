import type { IconName } from '@nevo/ui';
import type { SpecificationTaskResponse } from '@nevo/specflow-contracts/specs/workspace';

export type TaskLifecycle = 'pending' | 'in_progress' | 'completed' | 'blocked';

export interface TaskExecutionReadiness {
  readonly canExecute: boolean;
  /** Backend-owned semantic unavailability reason, not translated cache text. */
  readonly reasonCode?: string;
  readonly blockers?: readonly string[];
  readonly warnings?: readonly string[];
}

export interface TaskEvidence {
  readonly label: string;
  readonly href?: string;
}

export interface TaskRelatedSession {
  readonly id: string;
  readonly title: string;
}

export interface TaskItem {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly statusCode?: TaskLifecycle;
  readonly lifecycle?: TaskLifecycle;
  readonly attention?: boolean;
  readonly additionalInfo?: string;
  readonly group: string;
  readonly purpose?: string;
  readonly acceptanceCriteria?: readonly string[];
  readonly workflow?: string;
  readonly evidence?: readonly TaskEvidence[];
  readonly relatedSessions?: readonly TaskRelatedSession[];
  readonly history?: readonly string[];
}

export interface TaskGroup {
  readonly id: string;
  readonly name: string;
  readonly tasks: readonly TaskItem[];
}

export interface TaskStatePresentation {
  readonly icon?: IconName;
  readonly tone?: 'attention' | 'info' | 'neutral' | 'success';
  readonly iconClassName?: string;
  readonly textClassName?: string;
  readonly animate?: boolean;
}

export function getTaskStatePresentation(task: TaskItem): TaskStatePresentation {
  if (task.lifecycle === 'blocked' || task.attention) {
    return {
      icon: 'triangle-alert',
      tone: 'attention',
      iconClassName: 'text-status-attention',
      textClassName: 'text-status-attention font-medium',
    };
  }

  if (task.lifecycle === 'in_progress') {
    return {
      icon: 'loader',
      tone: 'info',
      iconClassName: 'text-accent-primary animate-spin',
      textClassName: 'text-accent-primary font-medium',
      animate: true,
    };
  }

  if (task.lifecycle === 'completed') {
    return {
      icon: 'circle-check',
      tone: 'success',
      iconClassName: 'text-status-success',
      textClassName: 'text-content-secondary',
    };
  }

  return {
    tone: 'neutral',
    iconClassName: 'text-content-muted',
    textClassName: 'text-content-muted',
  };
}

/** Full Task identity and detail are independent of Workspace task-group membership. */
export interface FullTaskData {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly statusCode?: TaskLifecycle;
  readonly additionalInfo?: string;
  readonly purpose?: string;
  readonly acceptanceCriteria?: readonly string[];
  readonly workflow?: string;
  readonly evidence?: readonly { label: string; href?: string }[];
  readonly relatedSessions?: readonly { id: string; title: string }[];
  readonly history?: readonly string[];
}

export function mapFullTaskResponse(response: SpecificationTaskResponse): FullTaskData {
  return {
    id: response.task.id,
    title: response.task.title,
    status: response.task.status.lifecycle,
    statusCode: response.task.status.lifecycle,
    purpose: response.purpose,
    acceptanceCriteria: response.acceptanceCriteria,
    workflow: response.workflow,
  };
}
