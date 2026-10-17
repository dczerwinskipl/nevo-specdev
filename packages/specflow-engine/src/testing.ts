/** Internal integration-test surface. Not used by production adapters. */
export * from './index';

export {
  PROJECT_HOME_MARKER_RELATIVE_PATH,
  PROJECT_STATE_RELATIVE_PATH,
} from './project/project-home';
export {
  WORKSPACE_REGISTRY_RELATIVE_PATH,
  WORKSPACE_REGISTRY_VERSION,
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
} from './project/workspace-registry';
export {
  PROJECT_CONTROL_LOCK_RELATIVE_PATH,
  inspectProjectControlLock,
  projectControlLockPath,
  withProjectControlLock,
  type ProjectControlLockInspection,
  type ProjectControlLockOptions,
} from './project/control-lock';
export { initializeWorkspaceRegistry, updateWorkspaceRegistry } from './project/registry-store';
export {
  WORKSPACE_IDENTITY_RELATIVE_PATH,
  provisionLinkedWorkspaceIdentity,
  verifyLinkedWorkspaceIdentity,
} from './project/workspace-identity';
export { GIT_INSTANCE_SENTINEL_FILE } from './project/git-instance';
export {
  createSpecificationScaffold,
  isValidSpecificationId,
  parseSpecificationManifest,
  specificationSlugFromTitle,
  validateSpecificationSlug,
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
  createSpecification,
  type CreateSpecificationInput,
  type CreateSpecificationOptions,
  type CreateSpecificationTarget,
} from './specs/durable-create';
export { CREATE_JOURNAL_RELATIVE_DIR } from './specs/create-journal';
export { createSpecificationForTesting, type TestCreateOptions } from './specs/create-test-support';

// Internal verification surface for planned lifecycle operations; no transport mutations yet.
export { previewCloseOperation, type CloseRequest } from './specs/lifecycle/preflight';
export { reserveCloseOperation, inspectCloseOperation } from './specs/lifecycle/reservation';
export { CloseOperationError, type CloseJournal, type ClosePlan } from './specs/lifecycle/model';
export { assertResourcesAvailable, resourcesForCreate } from './specs/lifecycle/resources';
export { listCloseJournals, closeJournalPath } from './specs/lifecycle/journal-store';
