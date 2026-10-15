export interface SpecProgressRecord {
  readonly completed: number;
  readonly total: number;
}

export interface SpecPullRequestRecord {
  readonly number: number;
  readonly url: string;
}

export interface SpecOverviewRecord {
  readonly id: string;
  readonly title: string;
  readonly key?: string;
  readonly pullRequests?: readonly SpecPullRequestRecord[];
  readonly tags?: readonly string[];
  readonly updatedAt: string;
  readonly progress: SpecProgressRecord | null;
}

export type CurrentSpecAttentionReasonRecord =
  'input' | 'decision' | 'review' | 'blocked' | 'approval';

export type CurrentSpecSignalKindRecord = 'attention' | 'ready' | 'working' | 'issue' | 'quiet';

export type CurrentSpecTargetRecord =
  | { readonly kind: 'specification'; readonly specId: string }
  | { readonly kind: 'task'; readonly specId: string; readonly taskId: string }
  | { readonly kind: 'session'; readonly specId: string; readonly sessionId: string };

export interface CurrentSpecSignalRecord {
  readonly id: string;
  readonly kind: CurrentSpecSignalKindRecord;
  readonly label: string;
  readonly reason?: string;
  readonly attentionReason?: CurrentSpecAttentionReasonRecord;
  readonly count?: number;
  readonly priority: number;
  readonly target: CurrentSpecTargetRecord;
}

export interface CurrentSpecRecord extends SpecOverviewRecord {
  readonly readyForWork: boolean | null;
  readonly signals: readonly CurrentSpecSignalRecord[] | null;
  readonly currentExecutions:
    | readonly {
        readonly sessionId: string;
        readonly agentRole: string;
        readonly taskIds: readonly string[];
      }[]
    | null;
}

export interface ArchivedSpecRecord extends SpecOverviewRecord {
  readonly completedAt?: string;
  readonly archivedAt?: string;
}
