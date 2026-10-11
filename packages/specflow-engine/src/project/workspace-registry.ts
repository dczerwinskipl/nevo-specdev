import { randomUUID } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';

import { resolveProjectHome, type ResolvedProjectHome } from './project-home';

export const WORKSPACE_REGISTRY_RELATIVE_PATH = 'workspaces.json';
export const WORKSPACE_REGISTRY_VERSION = 1;

export type WorkspaceRegistryErrorCode =
  | 'REGISTRY_NOT_FOUND'
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

export function validateWorkspaceRegistry(
  source: unknown,
  context: ResolvedProjectHome,
): WorkspaceRegistry {
  if (!isObject(source)) {
    throw corrupt('Registry root must be an object.');
  }
  if (source.version !== WORKSPACE_REGISTRY_VERSION) {
    throw new WorkspaceRegistryError(
      'REGISTRY_UNSUPPORTED_VERSION',
      'Unsupported workspace registry version. Explicit migration is required.',
    );
  }
  if (typeof source.projectId !== 'string' || source.projectId !== context.project.projectId) {
    throw new WorkspaceRegistryError(
      'REGISTRY_PROJECT_MISMATCH',
      'Registry project identity differs from the verified Project Home.',
    );
  }
  if (
    !Number.isSafeInteger(source.revision) ||
    (source.revision as number) < 0 ||
    !isIdentifier(source.primaryWorkspaceId) ||
    !Array.isArray(source.workspaces) ||
    !Array.isArray(source.specBindings)
  ) {
    throw corrupt('Invalid registry revision, primary identity or collections.');
  }

  const workspaces: WorkspaceRegistration[] = [];
  const workspaceIds = new Set<string>();
  const paths = new Set<string>();
  for (const value of source.workspaces) {
    if (
      !isObject(value) ||
      !isIdentifier(value.workspaceId) ||
      (value.kind !== 'primary' && value.kind !== 'linked') ||
      typeof value.root !== 'string' ||
      !isAbsolute(value.root) ||
      resolve(value.root) !== value.root ||
      typeof value.managed !== 'boolean'
    ) {
      throw corrupt('Invalid workspace registration.');
    }
    if (workspaceIds.has(value.workspaceId) || paths.has(pathKey(value.root))) {
      throw corrupt('Duplicate workspace identity or root.');
    }
    workspaceIds.add(value.workspaceId);
    paths.add(pathKey(value.root));
    workspaces.push({
      workspaceId: value.workspaceId,
      kind: value.kind,
      root: value.root,
      managed: value.managed,
    });
  }

  const primary = workspaces.filter((w) => w.kind === 'primary');
  if (
    primary.length !== 1 ||
    primary[0]?.workspaceId !== source.primaryWorkspaceId ||
    primary[0]?.root !== context.project.homeRoot ||
    primary[0]?.managed
  ) {
    throw corrupt('Exactly one unmanaged primary workspace must identify Project Home.');
  }

  const specIds = new Set<string>();
  const bindings: SpecWorkspaceBinding[] = [];
  for (const value of source.specBindings) {
    if (
      !isObject(value) ||
      !isIdentifier(value.specId) ||
      !isIdentifier(value.workspaceId) ||
      !workspaceIds.has(value.workspaceId) ||
      !Number.isSafeInteger(value.generation) ||
      (value.generation as number) < 0 ||
      (value.generation as number) > (source.revision as number)
    ) {
      throw corrupt('Invalid specification binding or unknown workspace identity.');
    }
    if (specIds.has(value.specId)) throw corrupt('Duplicate specification identity.');
    specIds.add(value.specId);
    bindings.push({
      specId: value.specId,
      workspaceId: value.workspaceId,
      generation: value.generation as number,
    });
  }

  return {
    version: WORKSPACE_REGISTRY_VERSION,
    projectId: source.projectId,
    revision: source.revision as number,
    primaryWorkspaceId: source.primaryWorkspaceId as string,
    workspaces,
    specBindings: bindings,
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
      throw new WorkspaceRegistryError(
        'REGISTRY_NOT_FOUND',
        'Workspace registry is absent. Initialize or recover explicitly.',
      );
    }
    throw error;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    throw corrupt('Workspace registry JSON is invalid; do not overwrite or reset it.');
  }
  return validateWorkspaceRegistry(parsed, context);
}

/** Validate membership *before* registration or acting upon a stored root. */
export async function verifyWorkspaceRoot(
  context: ResolvedProjectHome,
  root: string,
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
      root: await verifyWorkspaceRoot(context, workspace.root),
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

function isIdentifier(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pathKey(value: string): string {
  return process.platform === 'win32' ? value.toLowerCase() : value;
}

function isMissing(error: unknown): boolean {
  return isObject(error) && error.code === 'ENOENT';
}

function corrupt(message: string): WorkspaceRegistryError {
  return new WorkspaceRegistryError('REGISTRY_CORRUPT', message);
}
