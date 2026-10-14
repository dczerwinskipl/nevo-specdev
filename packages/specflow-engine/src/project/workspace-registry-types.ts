export const WORKSPACE_REGISTRY_RELATIVE_PATH = 'workspaces.json';
export const WORKSPACE_REGISTRY_VERSION = 1;

export type WorkspaceRegistryErrorCode =
  | 'REGISTRY_NOT_FOUND'
  | 'REGISTRY_RECOVERY_REQUIRED'
  | 'REGISTRY_CORRUPT'
  | 'REGISTRY_UNSUPPORTED_VERSION'
  | 'REGISTRY_PROJECT_MISMATCH'
  | 'REGISTRY_CONFLICT'
  | 'REGISTRY_WORKSPACE_UNAVAILABLE'
  | 'REGISTRY_WORKSPACE_MISMATCH';

export class WorkspaceRegistryError extends Error {
  readonly code: WorkspaceRegistryErrorCode;

  constructor(code: WorkspaceRegistryErrorCode, message: string) {
    super(message);
    this.name = 'WorkspaceRegistryError';
    this.code = code;
  }
}

export interface WorkspaceRegistration {
  readonly workspaceId: string;
  readonly kind: 'primary' | 'linked';
  readonly root: string;
  readonly managed: boolean;
  /** Physical checkout incarnation; required for linked workspaces. */
  readonly instanceId?: string;
}

export interface SpecWorkspaceBinding {
  readonly specId: string;
  readonly workspaceId: string;
  /** Registry revision at which this binding was last changed. */
  readonly generation: number;
}

export interface WorkspaceRegistry {
  readonly version: 1;
  readonly projectId: string;
  /** Monotonically increasing CAS revision, advanced under the project control lock. */
  readonly revision: number;
  readonly primaryWorkspaceId: string;
  readonly workspaces: readonly WorkspaceRegistration[];
  readonly specBindings: readonly SpecWorkspaceBinding[];
}

export type RegisteredWorkspaceInspection =
  | {
      readonly status: 'available';
      readonly workspace: WorkspaceRegistration;
      readonly root: string;
    }
  | {
      readonly status: 'unavailable';
      readonly workspace: WorkspaceRegistration;
      readonly reason: string;
    };
