import { createHash } from 'node:crypto';

import { validateOperationId } from '../create-journal';
import { isValidSpecificationId } from '../model';

export type CloseKind = 'worktree-close' | 'specification-close';

export type CloseIntent =
  | {
      readonly kind: 'worktree-close';
      readonly operationId: string;
      readonly specId: string;
    }
  | {
      readonly kind: 'specification-close';
      readonly operationId: string;
      readonly specId: string;
      readonly integrateToTargetBranch: boolean;
    };

export type CloseStage =
  | 'reserved'
  | 'archive-initiated'
  | 'archive-committed'
  | 'integration-preparation-initiated'
  | 'integration-publish-initiated'
  | 'integration-verified'
  | 'binding-rebound'
  | 'disposal-initiated'
  | 'completed'
  | 'archived-linked-awaiting-integration'
  | 'recovery-required';

export type CloseOutcome =
  | 'integrated-and-removed'
  | 'archive-only-closed'
  | 'archived-linked-awaiting-integration'
  | 'archived-in-primary'
  | 'worktree-integrated-and-removed';

export interface CloseWorkspaceEvidence {
  readonly workspaceId: string;
  readonly root: string;
  readonly branch: string;
  readonly head: string;
  readonly instanceId?: string;
}

export interface ClosePlan {
  readonly kind: CloseKind;
  readonly operationId: string;
  readonly specId: string;
  readonly fingerprint: string;
  readonly slug: string;
  readonly location: 'active' | 'archive';
  readonly registryRevision: number;
  readonly bindingGeneration?: number;
  readonly source: CloseWorkspaceEvidence;
  readonly target?: CloseWorkspaceEvidence;
  readonly targetBranch?: string;
  readonly integrateToTargetBranch?: boolean;
  readonly configRevision?: string;
  readonly resources: readonly string[];
}

export interface CloseJournal {
  readonly version: 1;
  readonly projectId: string;
  readonly gitInstanceId: string;
  readonly stage: CloseStage;
  readonly plan: ClosePlan;
  readonly outcome?: CloseOutcome;
  readonly reason?: string;
}

/** Intent fingerprint is independent of git defaults and mutable filesystem state. */
export function fingerprintCloseIntent(input: CloseIntent): string {
  validateOperationId(input.operationId);
  return createHash('sha256').update(JSON.stringify(input), 'utf8').digest('hex');
}

export function normalizeCloseIntent(input: CloseIntent): CloseIntent {
  validateOperationId(input.operationId);
  if (!isValidSpecificationId(input.specId)) {
    throw new CloseOperationError('CLOSE_INVALID', 'Invalid Specification identity.');
  }
  if (input.kind === 'worktree-close') {
    return { kind: 'worktree-close', operationId: input.operationId, specId: input.specId };
  }
  if (input.kind === 'specification-close' && typeof input.integrateToTargetBranch === 'boolean') {
    return {
      kind: 'specification-close',
      operationId: input.operationId,
      specId: input.specId,
      integrateToTargetBranch: input.integrateToTargetBranch,
    };
  }
  throw new CloseOperationError('CLOSE_INVALID', 'Invalid lifecycle operation kind or options.');
}

/** Derived resource identities must agree with persisted intent, not a forged list. */
export function resourcesForClosePlan(
  plan: ClosePlan,
  projectId: string,
): readonly string[] {
  const integrate = plan.kind === 'worktree-close' || plan.integrateToTargetBranch === true;
  const values = [
    'spec:' + plan.specId,
    'checkout:' + plan.source.workspaceId,
    'ref:refs/heads/' + plan.source.branch.toLowerCase(),
    ...(plan.target && plan.target.workspaceId !== plan.source.workspaceId
      ? [
          'checkout:' + plan.target.workspaceId,
          'ref:refs/heads/' + plan.target.branch.toLowerCase(),
        ]
      : []),
    ...(plan.source.instanceId && integrate ? ['git-worktree-admin:' + projectId] : []),
  ];
  return [...new Set(values)].sort();
}

export type CloseOperationErrorCode =
  | 'CLOSE_INVALID'
  | 'CLOSE_CONFLICT'
  | 'CLOSE_UNAVAILABLE'
  | 'CLOSE_PREFLIGHT'
  | 'CLOSE_RECOVERY_REQUIRED'
  | 'CLOSE_JOURNAL_CORRUPT';

export class CloseOperationError extends Error {
  constructor(
    readonly code: CloseOperationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CloseOperationError';
  }
}
