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
  readonly instanceId: string;
}

export type CreateJournalTarget = ExistingJournalTarget | NewWorktreeJournalTarget;

export interface CreateJournalFile {
  readonly relativePath: string;
  readonly sha256: string;
}

/** Single current durable Create format. No unpublished prototype migrations. */
export interface CreateJournal {
  readonly version: 2;
  readonly projectId: string;
  readonly operationId: string;
  readonly requestIntent: CreateClientIntent;
  readonly inputFingerprint: string;
  readonly specId: string;
  readonly slug: string;
  readonly title: string;
  readonly created: string;
  readonly goal?: string;
  readonly stage: CreateStage;
  readonly target: CreateJournalTarget;
  readonly files: readonly CreateJournalFile[];
  readonly gitPlan?: { readonly projectRoot: string; readonly gitInstanceId: string };
  readonly reason?: string;
}
