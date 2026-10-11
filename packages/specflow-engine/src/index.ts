// Public Engine boundary: dependency-free of CLI, Runtime, HTTP, providers and UI.
// This first capability exposes checkout-local bootstrap semantics only.
// Canonical Project Home and durable coordination belong to subsequent tasks.
export {
  isGitIgnored,
  LOCAL_CONFIG_RELATIVE_PATH,
  LOCAL_IGNORE_ENTRY,
  PROJECT_CONFIG_RELATIVE_PATH,
  resolveGitCheckoutLayout,
  type GitCheckoutLayout,
} from './project/git-checkout';

// A validated, read-only Project Home locator. Initialization/registry writes
// intentionally remain behind the later coordination and composition gates.
export {
  PROJECT_HOME_MARKER_RELATIVE_PATH,
  PROJECT_STATE_RELATIVE_PATH,
  ProjectHomeError,
  resolveProjectHome,
  type ProjectHomeErrorCode,
  type ResolveProjectHomeOptions,
  type ResolvedProjectHome,
} from './project/project-home';

export {
  WORKSPACE_REGISTRY_RELATIVE_PATH,
  WORKSPACE_REGISTRY_VERSION,
  WorkspaceRegistryError,
  addWorkspace,
  bindSpecToWorkspace,
  initialWorkspaceRegistry,
  inspectRegisteredWorkspace,
  readWorkspaceRegistry,
  registerInitialPrimary,
  resolveSpecWorkspaceId,
  validateWorkspaceRegistry,
  verifyWorkspaceRoot,
  workspaceRegistryPath,
  type RegisteredWorkspaceInspection,
  type SpecWorkspaceBinding,
  type WorkspaceRegistration,
  type WorkspaceRegistry,
  type WorkspaceRegistryErrorCode,
} from './project/workspace-registry';

export {
  PROJECT_CONTROL_LOCK_RELATIVE_PATH,
  ProjectControlLockError,
  inspectProjectControlLock,
  projectControlLockPath,
  withProjectControlLock,
  type ProjectControlLockErrorCode,
  type ProjectControlLockInspection,
  type ProjectControlLockOptions,
} from './project/control-lock';

export {
  initializeWorkspaceRegistry,
  updateWorkspaceRegistry,
  type RegistryUpdateOptions,
} from './project/registry-store';
