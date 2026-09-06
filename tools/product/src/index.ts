// Public surface of nevo-repo-product — imported by tests and the product
// package build script. The executable is `./bin.ts`.

export { bundleProduct, type BundleInput } from './bundle.js';
export { packProduct, type PackOptions, type PackResult } from './pack.js';
export { dogfoodInstall, type DogfoodResult } from './dogfood.js';
export { resolveProductVersion, type ResolveVersionInput } from './version.js';
export { findRepoRoot, repoPaths, type RepoPaths } from './paths.js';
export { StepFailedError } from './exec.js';
export { createProgram, type CliIO } from './cli.js';
export { DASHBOARD_BOOTSTRAP_MARKER } from './markers.js';
