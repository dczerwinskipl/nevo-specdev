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
