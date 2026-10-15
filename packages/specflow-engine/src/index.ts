// Supported application and transport boundary. Test/fixture internals live in ./testing.
export {
  isGitIgnored,
  LOCAL_CONFIG_RELATIVE_PATH,
  LOCAL_IGNORE_ENTRY,
  PROJECT_CONFIG_RELATIVE_PATH,
  resolveGitCheckoutLayout,
  type GitCheckoutLayout,
} from './project/git-checkout';

export {
  ProjectHomeError,
  resolveProjectHome,
  type ProjectHomeErrorCode,
  type ResolveProjectHomeOptions,
  type ResolvedProjectHome,
} from './project/project-home';

export {
  WorkspaceRegistryError,
  type WorkspaceRegistration,
  type WorkspaceRegistry,
  type WorkspaceRegistryErrorCode,
} from './project/workspace-registry';

export { ProjectControlLockError, type ProjectControlLockErrorCode } from './project/control-lock';
export type { RegistryUpdateOptions } from './project/registry-store';

export { openSpecFlowEngine, type SpecFlowEngine } from './application';
export { bootstrapProjectHome, assertPrimaryGitCheckout } from './project/bootstrap';

export {
  SpecificationError,
  type SpecificationErrorCode,
  type SpecificationLocation,
  type SpecificationManifest,
} from './specs/model';

export { GitCapabilityError, type GitCapabilityErrorCode } from './git/errors';

export {
  discoverSpecifications,
  resolveSpecification,
  type DiscoveredSpecification,
} from './specs/discovery';

export {
  inspectCreateSpecification,
  type CreatedSpecification,
} from './specs/durable-create';

export {
  readCanonicalSpecDocument,
  readCanonicalSpecSources,
  type CanonicalDocumentRead,
  type CanonicalSpecSource,
} from './specs/canonical-source';

export { CreateOperationError, type CreateJournal, type CreateStage } from './specs/create-journal';

export {
  createSpecificationFromRequest,
  type CreateSpecificationRequest,
} from './specs/create-request';
