/**
 * Runtime-owned read projection: not an HTTP response.
 * Authorization/redaction and transport availability are applied at the endpoint.
 */
export type SourceSection<T> =
  | { readonly state: 'available'; readonly data: T }
  | { readonly state: 'unavailable'; readonly reason: 'not_implemented' | 'source_unavailable' };

export interface WorkspaceTaskRecord {
  readonly id: string;
  readonly title: string;
  readonly status: {
    readonly id: string;
    readonly label: string;
    readonly lifecycle: 'pending' | 'in_progress' | 'completed' | 'blocked';
  };
}
export interface WorkspaceSessionRecord {
  readonly id: string;
  readonly title: string;
  readonly taskIds: string[];
  readonly status: 'active' | 'attention' | 'quiet' | 'unknown';
}
export interface WorkspaceAttentionRecord {
  readonly id: string;
  readonly kind: 'task' | 'session' | 'git' | 'specification';
  readonly title: string;
  readonly reason: string;
  readonly targetId?: string;
  readonly priority?: 'critical' | 'high' | 'normal';
}
export interface WorkspaceActivityRecord {
  readonly id: string;
  readonly occurredAt: string;
  readonly kind: 'task' | 'session' | 'doc' | 'info';
  readonly title: string;
  readonly description: string;
  readonly targetId?: string;
  /** Mandatory when a generic event contains Session-owned information. */
  readonly relatedSessionId?: string;
}
export interface WorkspaceReadModel {
  readonly revision: string;
  readonly specification: {
    readonly id: string;
    readonly title: string;
    readonly summary: string;
    readonly preparationState: 'empty' | 'preparing' | 'prepared';
    readonly attention: WorkspaceAttentionRecord[];
  };
  readonly recommendedSessionId?: string;
  readonly sections: {
    readonly tasks: SourceSection<{
      readonly groups: {
        readonly id: string;
        readonly name: string;
        readonly tasks: WorkspaceTaskRecord[];
      }[];
      readonly completed: number;
      readonly total: number;
      readonly attention: WorkspaceAttentionRecord[];
    }>;
    readonly documents: SourceSection<{
      readonly items: {
        readonly id: string;
        readonly title: string;
        readonly kind: string;
        readonly summary?: string;
      }[];
    }>;
    readonly sessions: SourceSection<{
      readonly items: WorkspaceSessionRecord[];
      readonly attention: WorkspaceAttentionRecord[];
    }>;
    readonly activity: SourceSection<{ readonly items: WorkspaceActivityRecord[] }>;
    readonly repository: SourceSection<{
      readonly repositoryName?: string;
      readonly branch?: string;
      readonly baseBranch?: string;
      readonly uncommittedCount?: number;
      readonly attention: WorkspaceAttentionRecord[];
    }>;
    readonly changes: SourceSection<{
      readonly base: string[];
      readonly uncommitted: string[];
      readonly mr: string[];
    }>;
  };
  readonly actions: {
    readonly executeTasks: { readonly available: boolean; readonly reason?: string };
    readonly startSession: { readonly available: boolean; readonly reason?: string };
  };
}
export type SpecificationReadModel = Omit<
  WorkspaceReadModel,
  'sections' | 'recommendedSessionId'
> & { sections: Pick<WorkspaceReadModel['sections'], 'activity' | 'repository' | 'changes'> };
export interface SpecificationWorkspaceRepository {
  readSpecification(specId: string): Promise<SpecificationReadModel | null>;
}
export interface WorkspaceContributions {
  tasks?(specId: string): Promise<WorkspaceReadModel['sections']['tasks']>;
  documents?(specId: string): Promise<WorkspaceReadModel['sections']['documents']>;
  sessions?(specId: string): Promise<{
    section: WorkspaceReadModel['sections']['sessions'];
    recommendedSessionId?: string;
  }>;
}
