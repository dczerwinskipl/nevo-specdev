/**
 * INTERNAL Engine port for local Version Control worktrees.
 * The mutation method must never be exported from the Engine package entrypoint.
 * Only an Engine operation with persisted, coordinated intent may call create().
 */
export type WorktreeAvailability =
  | { readonly status: 'available' }
  | { readonly status: 'disabled' }
  | { readonly status: 'unavailable'; readonly reason: string };

export interface WorktreeRequest {
  readonly slug: string;
  readonly shortId: string;
  readonly baseRefOverride?: string;
  readonly branchOverride?: string;
  readonly targetPath?: string;
}

export interface WorktreePlan {
  readonly projectId: string;
  readonly gitInstanceId: string;
  readonly projectRoot: string;
  readonly baseCommit: string;
  readonly branch: string;
  readonly targetPath: string;
}

export type WorktreeEffect = 'absent' | 'present' | 'conflict';

export interface WorktreePort {
  availability(): Promise<WorktreeAvailability>;
  /** Side-effect-free and based on Project Home policy, never caller cwd. */
  plan(request: WorktreeRequest): Promise<WorktreePlan>;
  /** Validates durable evidence without re-applying new naming defaults. */
  validateReservedPlan(plan: WorktreePlan): Promise<void>;
  /** Examines the original Git effect; HEAD must still equal the planned base. */
  inspectEffect(plan: WorktreePlan): Promise<WorktreeEffect>;
  /** Mutating: caller MUST persist a git-initiated intent before invoking. */
  create(plan: WorktreePlan): Promise<void>;
  /** After completion, HEAD may advance; branch, path and identity may not change. */
  inspectCreated(plan: WorktreePlan): Promise<void>;
}
