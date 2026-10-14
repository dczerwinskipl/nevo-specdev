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

export {
  WORKSPACE_IDENTITY_RELATIVE_PATH,
  provisionLinkedWorkspaceIdentity,
  verifyLinkedWorkspaceIdentity,
} from './project/workspace-identity';

export { openSpecFlowEngine, type SpecFlowEngine } from './application';

export { bootstrapProjectHome, assertPrimaryGitCheckout } from './project/bootstrap';
export { GIT_INSTANCE_SENTINEL_FILE } from './project/git-instance';

export {
  SpecificationError,
  createSpecificationScaffold,
  isValidSpecificationId,
  parseSpecificationManifest,
  specificationSlugFromTitle,
  validateSpecificationSlug,
  type SpecificationErrorCode,
  type SpecificationLocation,
  type SpecificationManifest,
  type SpecificationScaffold,
  type SpecificationScaffoldFile,
  type SpecificationScaffoldInput,
} from './specs/model';

export {
  listWorkspaceSpecifications,
  readWorkspaceSpecification,
  type WorkspaceSpecification,
} from './specs/repository';

export {
  openGitCapability,
  type GitCapability,
  type GitWorktreeFacts,
  type GitWorktreePlan,
  type NewWorktreeRequest,
} from './git/capability';
export { GitCapabilityError, type GitCapabilityErrorCode } from './git/errors';

export {
  discoverSpecifications,
  resolveSpecification,
  type DiscoveredSpecification,
} from './specs/discovery';

export {
  createSpecification,
  inspectCreateSpecification,
  type CreatedSpecification,
  type CreateSpecificationInput,
  type CreateSpecificationOptions,
  type CreateSpecificationTarget,
} from './specs/durable-create';
export {
  CREATE_JOURNAL_RELATIVE_DIR,
  CreateOperationError,
  type CreateJournal,
  type CreateStage,
} from './specs/create-journal';
