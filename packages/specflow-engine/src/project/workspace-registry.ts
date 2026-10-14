import { randomUUID } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';

import {
  PROJECT_HOME_MARKER_RELATIVE_PATH,
  resolveProjectHome,
  type ResolvedProjectHome,
} from './project-home';
import { verifyLinkedWorkspaceIdentity } from './workspace-identity';
import { verifyGitInstance } from './git-instance';

import {
  WORKSPACE_REGISTRY_RELATIVE_PATH,
  WORKSPACE_REGISTRY_VERSION,
  WorkspaceRegistryError,
  type WorkspaceRegistration,
  type WorkspaceRegistry,
  type RegisteredWorkspaceInspection,
} from './workspace-registry-types';
import {
  corrupt,
  isIdentifier,
  pathKey,
  validateWorkspaceRegistry,
} from './workspace-registry-validation';

export {
  WORKSPACE_REGISTRY_RELATIVE_PATH,
  WORKSPACE_REGISTRY_VERSION,
  WorkspaceRegistryError,
} from './workspace-registry-types';
export type {
  WorkspaceRegistryErrorCode,
  WorkspaceRegistration,
  SpecWorkspaceBinding,
  WorkspaceRegistry,
  RegisteredWorkspaceInspection,
} from './workspace-registry-types';
export { validateWorkspaceRegistry } from './workspace-registry-validation';

export function workspaceRegistryPath(context: ResolvedProjectHome): string {
  return join(context.project.stateRoot, WORKSPACE_REGISTRY_RELATIVE_PATH);
}

/** Explicit initialization only. No read path silently creates an empty registry. */
export function initialWorkspaceRegistry(context: ResolvedProjectHome): WorkspaceRegistry {
  return {
    version: WORKSPACE_REGISTRY_VERSION,
    projectId: context.project.projectId,
    revision: 0,
    primaryWorkspaceId: randomUUID(),
    workspaces: [],
    specBindings: [],
  };
}

/** The primary registration is fixed by the designated Project Home, not caller cwd. */
export function registerInitialPrimary(
  registry: WorkspaceRegistry,
  context: ResolvedProjectHome,
): WorkspaceRegistry {
  if (registry.workspaces.length !== 0 || registry.specBindings.length !== 0) {
    throw new WorkspaceRegistryError('REGISTRY_CONFLICT', 'Initial registry must be empty.');
  }
  return {
    ...registry,
    workspaces: [
      {
        workspaceId: registry.primaryWorkspaceId,
        kind: 'primary',
        root: context.project.homeRoot,
        managed: false,
      },
    ],
  };
}

export async function readWorkspaceRegistry(
  context: ResolvedProjectHome,
): Promise<WorkspaceRegistry> {
  const path = workspaceRegistryPath(context);
  let source: string;
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink()) throw corrupt('Registry is not a regular file.');
    source = await readFile(path, 'utf8');
  } catch (error) {
    if (isMissing(error)) {
      throw await missingRegistryDiagnostic(context);
    }
    throw error;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    throw corrupt('Workspace registry JSON is invalid; do not overwrite or reset it.');
  }
  const registry = validateWorkspaceRegistry(parsed, context);
  await assertPersistedPrimaryIdentity(context, registry);
  return registry;
}

/**
 * The independently persisted Project Home identity is authoritative even when
 * workspaces.json is structurally valid. A stale backup cannot introduce a new
 * primary workspace ID under the same projectId.
 */
async function assertPersistedPrimaryIdentity(
  context: ResolvedProjectHome,
  registry: WorkspaceRegistry,
): Promise<void> {
  const markerPath = join(context.project.homeRoot, PROJECT_HOME_MARKER_RELATIVE_PATH);
  let marker: unknown;
  try {
    const stat = await lstat(markerPath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error('Project Home marker must be a regular file.');
    }
    marker = JSON.parse(await readFile(markerPath, 'utf8')) as unknown;
  } catch {
    throw new WorkspaceRegistryError(
      'REGISTRY_RECOVERY_REQUIRED',
      'Project Home bootstrap evidence is missing, corrupt or redirected.',
    );
  }

  if (
    !isObject(marker) ||
    marker.version !== 1 ||
    marker.registryBootstrap !== 'claimed' ||
    marker.projectId !== registry.projectId ||
    marker.homeRoot !== context.project.homeRoot ||
    marker.gitCommonDir !== context.project.gitCommonDir ||
    marker.gitInstanceId !== context.project.gitInstanceId ||
    marker.primaryWorkspaceId !== registry.primaryWorkspaceId
  ) {
    throw new WorkspaceRegistryError(
      'REGISTRY_RECOVERY_REQUIRED',
      'Registry primary identity differs from Project Home bootstrap; explicit recovery is required.',
    );
  }
  await verifyGitInstance(
    context.project.gitCommonDir,
    context.project.projectId,
    context.project.gitInstanceId,
  );
}

/** Validate membership *before* registration or acting upon a stored root. */
export async function verifyWorkspaceRoot(
  context: ResolvedProjectHome,
  root: string,
  registration?: WorkspaceRegistration,
): Promise<string> {
  if (!isAbsolute(root)) {
    throw new WorkspaceRegistryError(
      'REGISTRY_WORKSPACE_MISMATCH',
      'Workspace root must be absolute.',
    );
  }
  let canonical: string;
  try {
    canonical = await realpath(root);
  } catch (error) {
    if (!isMissing(error)) throw error;
    throw new WorkspaceRegistryError(
      'REGISTRY_WORKSPACE_UNAVAILABLE',
      'Registered workspace path is unavailable; binding is retained.',
    );
  }
  if (canonical !== root) {
    throw new WorkspaceRegistryError(
      'REGISTRY_WORKSPACE_MISMATCH',
      'Workspace root changed identity, moved or points through a symlink.',
    );
  }
  try {
    const verified = await resolveProjectHome({
      cwd: canonical,
      projectRoot: context.project.homeRoot,
    });
    if (
      verified.project.projectId !== context.project.projectId ||
      verified.project.gitCommonDir !== context.project.gitCommonDir ||
      verified.workspace.root !== canonical
    ) {
      throw new WorkspaceRegistryError(
        'REGISTRY_WORKSPACE_MISMATCH',
        'Workspace belongs to a different Project Home or Git repository.',
      );
    }
  } catch (error) {
    if (error instanceof WorkspaceRegistryError) throw error;
    throw new WorkspaceRegistryError(
      'REGISTRY_WORKSPACE_MISMATCH',
      'Workspace Git/Project Home identity could not be verified.',
    );
  }
  if (registration?.kind === 'linked') {
    await verifyLinkedWorkspaceIdentity(context, registration);
  }
  return canonical;
}

export async function inspectRegisteredWorkspace(
  context: ResolvedProjectHome,
  registry: WorkspaceRegistry,
  workspaceId: string,
): Promise<RegisteredWorkspaceInspection> {
  const workspace = registry.workspaces.find((w) => w.workspaceId === workspaceId);
  if (!workspace) {
    throw new WorkspaceRegistryError('REGISTRY_CONFLICT', 'Unregistered workspace identity.');
  }
  try {
    return {
      status: 'available',
      workspace,
      root: await verifyWorkspaceRoot(context, workspace.root, workspace),
    };
  } catch (error) {
    if (
      error instanceof WorkspaceRegistryError &&
      error.code === 'REGISTRY_WORKSPACE_UNAVAILABLE'
    ) {
      return { status: 'unavailable', workspace, reason: error.message };
    }
    throw error;
  }
}

/** A bound spec never silently falls back to a duplicate in the primary checkout. */
export function resolveSpecWorkspaceId(registry: WorkspaceRegistry, specId: string): string {
  const bound = registry.specBindings.find((item) => item.specId === specId);
  return bound?.workspaceId ?? registry.primaryWorkspaceId;
}

/** Pure transition; the T05 store serializes, validates and revises it under a lock. */
export function addWorkspace(
  registry: WorkspaceRegistry,
  registration: WorkspaceRegistration,
): WorkspaceRegistry {
  if (
    registry.workspaces.some(
      (w) =>
        w.workspaceId === registration.workspaceId ||
        pathKey(w.root) === pathKey(registration.root),
    )
  ) {
    throw new WorkspaceRegistryError(
      'REGISTRY_CONFLICT',
      'Workspace identity/root already registered.',
    );
  }
  if (
    registration.kind !== 'linked' ||
    !isIdentifier(registration.workspaceId) ||
    !isIdentifier(registration.instanceId) ||
    !isAbsolute(registration.root) ||
    resolve(registration.root) !== registration.root
  ) {
    throw new WorkspaceRegistryError('REGISTRY_CONFLICT', 'Invalid linked workspace registration.');
  }
  return { ...registry, workspaces: [...registry.workspaces, { ...registration }] };
}

export function bindSpecToWorkspace(
  registry: WorkspaceRegistry,
  specId: string,
  workspaceId: string,
): WorkspaceRegistry {
  if (!isIdentifier(specId) || !registry.workspaces.some((w) => w.workspaceId === workspaceId)) {
    throw new WorkspaceRegistryError(
      'REGISTRY_CONFLICT',
      'Invalid specId or unregistered workspace.',
    );
  }
  const previous = registry.specBindings.find((item) => item.specId === specId);
  if (previous) {
    if (previous.workspaceId === workspaceId) return registry;
    throw new WorkspaceRegistryError(
      'REGISTRY_CONFLICT',
      'Specification is already bound. Rebinding requires a separate CAS operation.',
    );
  }
  return {
    ...registry,
    specBindings: [
      ...registry.specBindings,
      { specId, workspaceId, generation: registry.revision + 1 },
    ],
  };
}

async function missingRegistryDiagnostic(
  context: ResolvedProjectHome,
): Promise<WorkspaceRegistryError> {
  const homeMarker = join(context.project.homeRoot, PROJECT_HOME_MARKER_RELATIVE_PATH);
  try {
    const source = JSON.parse(await readFile(homeMarker, 'utf8')) as unknown;
    if (
      isObject(source) &&
      source.projectId === context.project.projectId &&
      source.homeRoot === context.project.homeRoot &&
      source.gitCommonDir === context.project.gitCommonDir &&
      source.registryBootstrap === 'fresh'
    ) {
      return new WorkspaceRegistryError(
        'REGISTRY_NOT_FOUND',
        'Verified new Project Home has not initialized its registry yet.',
      );
    }
  } catch {
    // Lost/invalid evidence cannot prove a fresh Project Home.
  }
  return new WorkspaceRegistryError(
    'REGISTRY_RECOVERY_REQUIRED',
    'Registry is missing from an initialized or unverified Project Home; explicit recovery is required.',
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMissing(error: unknown): boolean {
  return isObject(error) && error.code === 'ENOENT';
}
