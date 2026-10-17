import type {
  CreateOperationError,
  GitCapabilityErrorCode,
  ProjectControlLockErrorCode,
  ProjectHomeErrorCode,
  SpecificationErrorCode,
  WorkspaceRegistryErrorCode,
} from '@nevo/specflow-engine';

export type CreateErrorCode =
  | CreateOperationError['code']
  | GitCapabilityErrorCode
  | ProjectControlLockErrorCode
  | ProjectHomeErrorCode
  | SpecificationErrorCode
  | WorkspaceRegistryErrorCode;

export type CreateHttpStatus = 400 | 409 | 422 | 503;

/** Explicit, exhaustive transport policy. Unknown failures stay HTTP 500. */
export function statusForCreateError(code: CreateErrorCode): CreateHttpStatus {
  switch (code) {
    case 'CREATE_OPERATION_INVALID':
    case 'SPEC_VALIDATION_ERROR':
      return 400;

    case 'CREATE_CONFLICT':
    case 'SPEC_CONFLICT':
    case 'REGISTRY_CONFLICT':
    case 'BRANCH_ALREADY_EXISTS':
    case 'BRANCH_ALREADY_CHECKED_OUT':
    case 'WORKTREE_PATH_CONFLICT':
      return 409;

    case 'GIT_DISABLED':
    case 'BASE_REF_NOT_FOUND':
    case 'GIT_BASE_CONFIG_MISSING':
      return 422;

    case 'CREATE_RECOVERY_REQUIRED':
    case 'CREATE_JOURNAL_CORRUPT':
    case 'PROJECT_HOME_NOT_FOUND':
    case 'PROJECT_HOME_AMBIGUOUS':
    case 'PROJECT_HOME_INVALID':
    case 'PROJECT_HOME_MISMATCH':
    case 'CONTROL_LOCK_BUSY':
    case 'CONTROL_LOCK_CORRUPT':
    case 'CONTROL_LOCK_OWNERSHIP_LOST':
    case 'CONTROL_LOCK_INVALID_HOME':
    case 'REGISTRY_NOT_FOUND':
    case 'REGISTRY_RECOVERY_REQUIRED':
    case 'REGISTRY_CORRUPT':
    case 'REGISTRY_UNSUPPORTED_VERSION':
    case 'REGISTRY_PROJECT_MISMATCH':
    case 'REGISTRY_WORKSPACE_UNAVAILABLE':
    case 'REGISTRY_WORKSPACE_MISMATCH':
    case 'GIT_POLICY_INVALID':
    case 'GIT_UNAVAILABLE':
    case 'NOT_GIT_REPOSITORY':
    case 'GIT_OPERATION_UNCERTAIN':
    case 'GIT_OPERATION_FAILED':
    case 'WORKTREE_MEMBERSHIP_MISMATCH':
    case 'SPEC_SOURCE_INVALID':
    case 'SPEC_NOT_FOUND':
      return 503;
    default: {
      const exhaustive: never = code;
      return exhaustive;
    }
  }
}
