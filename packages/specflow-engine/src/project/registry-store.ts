import { lstat, readFile } from 'node:fs/promises';

import { writeJsonAtomically } from './atomic-json';
import { withProjectControlLock, type ProjectControlLockOptions } from './control-lock';
import { PROJECT_HOME_MARKER_RELATIVE_PATH, type ResolvedProjectHome } from './project-home';
import { join } from 'node:path';
import {
  WorkspaceRegistryError,
  initialWorkspaceRegistry,
  readWorkspaceRegistry,
  registerInitialPrimary,
  validateWorkspaceRegistry,
  verifyWorkspaceRoot,
  workspaceRegistryPath,
  type WorkspaceRegistry,
  type WorkspaceRegistration,
} from './workspace-registry';

export interface RegistryUpdateOptions {
  /** Optional compare-and-set revision, checked after obtaining the cross-process lock. */
  readonly expectedRevision?: number;
  readonly lock?: ProjectControlLockOptions;
}

/**
 * Explicit one-time initialization, serialized by the same lock as updates.
 * Missing/corrupt state is never implicitly treated as an empty project.
 */
export async function initializeWorkspaceRegistry(
  context: ResolvedProjectHome,
  options: Pick<RegistryUpdateOptions, 'lock'> = {},
): Promise<WorkspaceRegistry> {
  if (context.workspace.root !== context.project.homeRoot) {
    throw new WorkspaceRegistryError(
      'REGISTRY_CONFLICT',
      'Initial registry designation must be explicitly initiated from Project Home.',
    );
  }
  return withProjectControlLock(
    context,
    async () => {
      const path = workspaceRegistryPath(context);
      try {
        await lstat(path);
        throw new WorkspaceRegistryError(
          'REGISTRY_CONFLICT',
          'Registry already exists. Load or explicitly recover it instead of resetting state.',
        );
      } catch (error) {
        if (!isMissing(error)) throw error;
      }
      // Claim virgin bootstrap in the Project Home authority *before* first
      // registry publication. If registry is later removed, or init crashes
      // after claiming, a second bootstrap is forbidden and requires recovery.
      const markerPath = join(context.project.homeRoot, PROJECT_HOME_MARKER_RELATIVE_PATH);
      const markerStat = await lstat(markerPath);
      if (!markerStat.isFile() || markerStat.isSymbolicLink()) {
        throw new WorkspaceRegistryError(
          'REGISTRY_RECOVERY_REQUIRED',
          'Project Home bootstrap evidence is not a regular file.',
        );
      }
      let marker: unknown;
      try {
        marker = JSON.parse(await readFile(markerPath, 'utf8')) as unknown;
      } catch {
        throw new WorkspaceRegistryError(
          'REGISTRY_RECOVERY_REQUIRED',
          'Project Home bootstrap evidence cannot be read.',
        );
      }
      if (
        !isRecord(marker) ||
        marker.version !== 1 ||
        marker.projectId !== context.project.projectId ||
        marker.homeRoot !== context.project.homeRoot ||
        marker.gitCommonDir !== context.project.gitCommonDir ||
        marker.registryBootstrap !== 'fresh'
      ) {
        throw new WorkspaceRegistryError(
          'REGISTRY_RECOVERY_REQUIRED',
          'First initialization cannot be proven. Missing registry must use explicit recovery.',
        );
      }
      await writeJsonAtomically(markerPath, { ...marker, registryBootstrap: 'claimed' });
      const initial = validateWorkspaceRegistry(
        registerInitialPrimary(initialWorkspaceRegistry(context), context),
        context,
      );
      await writeJsonAtomically(path, initial);
      return initial;
    },
    options.lock,
  );
}

/**
 * The only Engine-owned registry mutation port. Re-read *inside* the
 * cross-process lock, validate CAS, forbid implicit rebinds/removals, verify
 * every newly registered worktree and publish one validated snapshot.
 */
export async function updateWorkspaceRegistry(
  context: ResolvedProjectHome,
  mutate: (current: WorkspaceRegistry) => WorkspaceRegistry,
  options: RegistryUpdateOptions = {},
): Promise<WorkspaceRegistry> {
  return withProjectControlLock(
    context,
    async () => {
      const current = await readWorkspaceRegistry(context);
      const caller = current.workspaces.find((w) => w.root === context.workspace.root);
      if (!caller) {
        throw new WorkspaceRegistryError(
          'REGISTRY_CONFLICT',
          'An unregistered worktree cannot mutate the Project Home registry.',
        );
      }
      await verifyWorkspaceRoot(context, caller.root, caller);
      if (options.expectedRevision !== undefined && current.revision !== options.expectedRevision) {
        throw new WorkspaceRegistryError(
          'REGISTRY_CONFLICT',
          'Registry CAS revision changed; re-read before retrying.',
        );
      }
      const original = JSON.stringify(current);
      // Prevent a callback from mutating our comparison snapshot in place.
      const proposed = mutate(freezeRegistry(current));
      if (JSON.stringify(proposed) === original) return current;
      if (proposed?.revision !== current.revision) {
        throw new WorkspaceRegistryError(
          'REGISTRY_CONFLICT',
          'Registry revision is exclusively advanced by the coordinated store.',
        );
      }
      const next = validateWorkspaceRegistry(
        { ...proposed, revision: current.revision + 1 },
        context,
      );

      assertAppendOnlyTransition(current, next);
      for (const registration of next.workspaces) {
        if (current.workspaces.some((w) => w.workspaceId === registration.workspaceId)) {
          continue;
        }
        await verifyWorkspaceRoot(context, registration.root, registration);
      }
      // An old unavailable binding stays recorded, but a NEW binding must not
      // point at a disappeared, moved or substituted workspace.
      for (const binding of next.specBindings) {
        if (current.specBindings.some((item) => item.specId === binding.specId)) continue;
        const target = next.workspaces.find((item) => item.workspaceId === binding.workspaceId);
        if (!target) {
          throw new WorkspaceRegistryError('REGISTRY_CORRUPT', 'Binding workspace is absent.');
        }
        await verifyWorkspaceRoot(context, target.root, target);
      }

      await writeJsonAtomically(workspaceRegistryPath(context), next);
      return next;
    },
    options.lock,
  );
}

function assertAppendOnlyTransition(old: WorkspaceRegistry, next: WorkspaceRegistry): void {
  if (
    next.primaryWorkspaceId !== old.primaryWorkspaceId ||
    next.projectId !== old.projectId ||
    next.revision !== old.revision + 1
  ) {
    throw new WorkspaceRegistryError('REGISTRY_CONFLICT', 'Registry identity or revision changed.');
  }
  const oldWorkspaces = new Map(old.workspaces.map((w) => [w.workspaceId, w]));
  const nextWorkspaces = new Map(next.workspaces.map((w) => [w.workspaceId, w]));
  for (const [workspaceId, before] of oldWorkspaces) {
    if (!sameRegistration(before, nextWorkspaces.get(workspaceId))) {
      throw new WorkspaceRegistryError(
        'REGISTRY_CONFLICT',
        'Workspace relocation/removal requires a separately coordinated lifecycle operation.',
      );
    }
  }
  const oldBindings = new Map(old.specBindings.map((b) => [b.specId, b]));
  const nextBindings = new Map(next.specBindings.map((b) => [b.specId, b]));
  for (const [specId, before] of oldBindings) {
    const after = nextBindings.get(specId);
    if (after?.workspaceId !== before.workspaceId || after?.generation !== before.generation) {
      throw new WorkspaceRegistryError(
        'REGISTRY_CONFLICT',
        'Specification rebind/removal is not permitted by this registration port.',
      );
    }
  }
  for (const binding of next.specBindings) {
    if (!oldBindings.has(binding.specId) && binding.generation !== next.revision) {
      throw new WorkspaceRegistryError(
        'REGISTRY_CONFLICT',
        'New specification binding generation must match the committed revision.',
      );
    }
  }
}

function sameRegistration(
  before: WorkspaceRegistration,
  after: WorkspaceRegistration | undefined,
): boolean {
  return (
    !!after &&
    before.workspaceId === after.workspaceId &&
    before.kind === after.kind &&
    before.root === after.root &&
    before.managed === after.managed &&
    before.instanceId === after.instanceId
  );
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}

function freezeRegistry(registry: WorkspaceRegistry): WorkspaceRegistry {
  for (const workspace of registry.workspaces) Object.freeze(workspace);
  for (const binding of registry.specBindings) Object.freeze(binding);
  Object.freeze(registry.workspaces);
  Object.freeze(registry.specBindings);
  return Object.freeze(registry);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
