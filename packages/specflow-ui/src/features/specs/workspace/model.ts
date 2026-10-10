import type { IconName } from '@nevo/ui';
import type { TaskExecutionReadiness, TaskGroup } from '../../tasks/model';

export {
  getTaskStatePresentation,
  type TaskLifecycle,
  type TaskExecutionReadiness,
  type TaskEvidence,
  type TaskRelatedSession,
  type TaskItem,
  type TaskGroup,
  type TaskStatePresentation,
} from '../../tasks/model';

export interface DocumentSection {
  readonly heading: string;
  readonly content?: string;
  readonly items?: readonly string[];
}

export interface DocumentItem {
  readonly id: string;
  readonly title: string;
  readonly kind: string;
  readonly summary?: string;
  readonly content?: string;
  readonly sections?: readonly DocumentSection[];
}

export interface SessionActivity {
  readonly label: string;
  readonly tone?: 'attention' | 'info' | 'neutral' | 'success';
  readonly icon?: IconName;
  readonly animate?: boolean;
}

export interface SessionSummary {
  readonly id: string;
  readonly title: string;
  readonly meta?: string;
  readonly taskCount?: string;
  readonly age?: string;
  readonly activity?: SessionActivity;
  readonly activityCode?: 'active' | 'attention';
}

export interface AttentionItem {
  readonly id: string;
  readonly kind: 'task' | 'session' | 'git' | 'specification';
  readonly title: string;
  readonly reason: string;
  readonly actionLabel: string;
  readonly actionCode?: 'task' | 'session' | 'git' | 'specification';
  readonly targetId?: string;
  readonly priority?: 'critical' | 'high' | 'normal';
}

/** A missing domain read is not an empty Attention list. */
export type FeatureAttentionSource =
  | { readonly state: 'available'; readonly items: readonly AttentionItem[] }
  | { readonly state: 'unavailable'; readonly reason: 'source_unavailable' | 'not_implemented' }
  | { readonly state: 'forbidden' };

export interface FeatureAttentionData {
  readonly tasks: FeatureAttentionSource;
  readonly sessions: FeatureAttentionSource;
  readonly git: FeatureAttentionSource;
}

export interface RepoContext {
  readonly branch?: string;
  readonly baseBranch?: string;
  readonly uncommittedCount?: number;
  readonly syncStatus?: string;
  readonly conflictStatus?: string;
  readonly repositoryName?: string;
  readonly linkedPr?: {
    readonly number: number;
    readonly title: string;
  };
  readonly otherPrs?: readonly {
    readonly number: number;
    readonly title: string;
    readonly status: string;
  }[];
  readonly isDirty?: boolean;
  readonly freshness?: 'fresh' | 'stale' | 'unknown';
}

export type ActivityEventKind = 'task' | 'session' | 'doc' | 'info';

export interface BaseActivityEvent {
  readonly id: string;
  readonly time: string;
  readonly title: string;
  readonly description: string;
}

export interface TaskActivityEvent extends BaseActivityEvent {
  readonly kind: 'task';
  readonly targetId: string;
}

export interface SessionActivityEvent extends BaseActivityEvent {
  readonly kind: 'session';
  readonly targetId: string;
}

export interface DocumentActivityEvent extends BaseActivityEvent {
  readonly kind: 'doc';
  readonly targetId: string;
}

export interface InformationalActivityEvent extends BaseActivityEvent {
  readonly kind: 'info';
  readonly targetId?: string;
}

export type ActivityEvent =
  TaskActivityEvent | SessionActivityEvent | DocumentActivityEvent | InformationalActivityEvent;

export interface SpecificationChangesData {
  readonly base?: readonly string[];
  readonly uncommitted?: readonly string[];
  readonly mr?: readonly string[];
}

export type SpecificationSectionId =
  'tasks' | 'documents' | 'sessions' | 'activity' | 'repository' | 'changes';
export type SpecificationSectionState = 'available' | 'unavailable' | 'forbidden';

export interface SpecificationWorkspaceData {
  readonly sectionAvailability?: Partial<Record<SpecificationSectionId, SpecificationSectionState>>;
  readonly id: string;
  readonly title: string;
  readonly intro: string;
  readonly mainDocumentId?: string;
  readonly isEmpty?: boolean;
  readonly isPreparing?: boolean;
  readonly hasGit?: boolean;
  /** Specification-owned entries only, not other features' Attention. */
  readonly attentionItems: readonly AttentionItem[];
  /** Facts provided by the owning Runtime feature sections. */
  readonly featureAttention?: FeatureAttentionData;
  readonly repoContext?: RepoContext;
  readonly resumeSession?: SessionSummary;
  readonly taskGroups: readonly TaskGroup[];
  readonly documents: readonly DocumentItem[];
  readonly sessions: readonly SessionSummary[];
  readonly activityEvents: readonly ActivityEvent[];
  readonly completedTasksCount?: number;
  readonly totalTasksCount?: number;
  readonly executionReadiness?: TaskExecutionReadiness;
  readonly changes?: SpecificationChangesData;
}
