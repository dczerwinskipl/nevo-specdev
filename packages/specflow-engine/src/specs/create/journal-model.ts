import type { CreateClientIntent } from '../create-intent';

export const CREATE_STAGES = [
  'reserved',
  'git-initiated',
  'git-provisioned',
  'manifest-writing',
  'manifest-written',
  'registry-writing',
  'registry-linked',
  'completed',
  'recovery-required',
] as const;

export type CreateStage = (typeof CREATE_STAGES)[number];

export interface ExistingJournalTarget {
  readonly kind: 'existing';
  readonly workspaceId: string;
  readonly workspaceRoot: string;
}

export interface NewWorktreeJournalTarget {
  readonly kind: 'new-worktree';
  readonly workspaceId: string;
  readonly workspaceRoot: string;
  readonly branch: string;
  readonly baseCommit: string;
  /** v1 journals may predate physical workspace identity markers. */
  readonly instanceId?: string;
}

export type CreateJournalTarget = ExistingJournalTarget | NewWorktreeJournalTarget;

/** v2 reservations pin the physical checkout identity before publication. */
export type CreateJournalV2Target =
  | ExistingJournalTarget
  | (NewWorktreeJournalTarget & { readonly instanceId: string });

export interface CreateJournalFile {
  readonly relativePath: string;
  readonly sha256: string;
}

export interface CreateJournalFields<TTarget extends CreateJournalTarget = CreateJournalTarget> {
  readonly projectId: string;
  readonly operationId: string;
  readonly inputFingerprint: string;
  readonly specId: string;
  readonly slug: string;
  readonly title: string;
  readonly created: string;
  readonly goal?: string;
  readonly stage: CreateStage;
  readonly target: TTarget;
  readonly files: readonly CreateJournalFile[];
  readonly reason?: string;
}

export interface CreateJournalV1 extends CreateJournalFields {
  readonly version: 1;
}

export interface CreateJournalV2 extends CreateJournalFields<CreateJournalV2Target> {
  readonly version: 2;
  readonly requestIntent: CreateClientIntent;
  readonly gitPlan?: { readonly projectRoot: string; readonly gitInstanceId: string };
}

export type CreateJournal = CreateJournalV1 | CreateJournalV2;
