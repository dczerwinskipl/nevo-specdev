export type GitCapabilityErrorCode =
  | 'GIT_DISABLED'
  | 'GIT_POLICY_INVALID'
  | 'GIT_UNAVAILABLE'
  | 'NOT_GIT_REPOSITORY'
  | 'WORKTREE_PATH_CONFLICT'
  | 'BRANCH_ALREADY_CHECKED_OUT'
  | 'BRANCH_ALREADY_EXISTS'
  | 'BASE_REF_NOT_FOUND'
  | 'GIT_BASE_CONFIG_MISSING'
  | 'GIT_OPERATION_UNCERTAIN'
  | 'GIT_OPERATION_FAILED'
  | 'WORKTREE_MEMBERSHIP_MISMATCH';

export class GitCapabilityError extends Error {
  readonly code: GitCapabilityErrorCode;

  constructor(code: GitCapabilityErrorCode, message: string) {
    super(message);
    this.name = 'GitCapabilityError';
    this.code = code;
  }
}
