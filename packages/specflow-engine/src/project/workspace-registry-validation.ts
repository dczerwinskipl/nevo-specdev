import { isAbsolute, resolve } from 'node:path';

import type { ResolvedProjectHome } from './project-home';
import {
  WORKSPACE_REGISTRY_VERSION,
  WorkspaceRegistryError,
  type SpecWorkspaceBinding,
  type WorkspaceRegistration,
  type WorkspaceRegistry,
} from './workspace-registry-types';

/** Pure schema and identity validation; never touches Git or the filesystem. */
export function validateWorkspaceRegistry(
  source: unknown,
  context: ResolvedProjectHome,
): WorkspaceRegistry {
  if (!isObject(source)) throw corrupt('Registry root must be an object.');
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

  const workspaces = parseRegistrations(source.workspaces);
  assertPrimaryRegistration(workspaces, source.primaryWorkspaceId, context.project.homeRoot);
  const specBindings = parseBindings(
    source.specBindings,
    new Set(workspaces.map((workspace) => workspace.workspaceId)),
    source.revision as number,
  );

  return {
    version: WORKSPACE_REGISTRY_VERSION,
    projectId: source.projectId,
    revision: source.revision as number,
    primaryWorkspaceId: source.primaryWorkspaceId,
    workspaces,
    specBindings,
  };
}

function parseRegistrations(values: unknown[]): WorkspaceRegistration[] {
  const workspaces: WorkspaceRegistration[] = [];
  const workspaceIds = new Set<string>();
  const paths = new Set<string>();
  for (const value of values) {
    const workspace = parseRegistration(value);
    if (workspaceIds.has(workspace.workspaceId) || paths.has(pathKey(workspace.root))) {
      throw corrupt('Duplicate workspace identity or root.');
    }
    workspaceIds.add(workspace.workspaceId);
    paths.add(pathKey(workspace.root));
    workspaces.push(workspace);
  }
  return workspaces;
}

function parseRegistration(value: unknown): WorkspaceRegistration {
  if (
    !isObject(value) ||
    !isIdentifier(value.workspaceId) ||
    (value.kind !== 'primary' && value.kind !== 'linked') ||
    typeof value.root !== 'string' ||
    !isAbsolute(value.root) ||
    resolve(value.root) !== value.root ||
    typeof value.managed !== 'boolean' ||
    (value.kind === 'linked' && !isIdentifier(value.instanceId)) ||
    (value.kind === 'primary' && value.instanceId !== undefined)
  ) {
    throw corrupt('Invalid workspace registration.');
  }
  return {
    workspaceId: value.workspaceId,
    kind: value.kind,
    root: value.root,
    managed: value.managed,
    ...(value.kind === 'linked' ? { instanceId: value.instanceId as string } : {}),
  };
}

function assertPrimaryRegistration(
  workspaces: readonly WorkspaceRegistration[],
  primaryWorkspaceId: string,
  homeRoot: string,
): void {
  const primary = workspaces.filter((workspace) => workspace.kind === 'primary');
  if (
    primary.length !== 1 ||
    primary[0]?.workspaceId !== primaryWorkspaceId ||
    primary[0]?.root !== homeRoot ||
    primary[0]?.managed
  ) {
    throw corrupt('Exactly one unmanaged primary workspace must identify Project Home.');
  }
}

function parseBindings(
  values: unknown[],
  workspaceIds: ReadonlySet<string>,
  revision: number,
): SpecWorkspaceBinding[] {
  const specIds = new Set<string>();
  const bindings: SpecWorkspaceBinding[] = [];
  for (const value of values) {
    if (
      !isObject(value) ||
      !isIdentifier(value.specId) ||
      !isIdentifier(value.workspaceId) ||
      !workspaceIds.has(value.workspaceId) ||
      !Number.isSafeInteger(value.generation) ||
      (value.generation as number) < 0 ||
      (value.generation as number) > revision
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
  return bindings;
}

export function isIdentifier(value: unknown): value is string {
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

export function pathKey(value: string): string {
  return process.platform === 'win32' ? value.toLowerCase() : value;
}

export function corrupt(message: string): WorkspaceRegistryError {
  return new WorkspaceRegistryError('REGISTRY_CORRUPT', message);
}
