import { randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';

import { isGitIgnored } from './git-checkout';
import type { ResolvedProjectHome } from './project-home';
import {
  WorkspaceRegistryError,
  verifyWorkspaceRoot,
  type WorkspaceRegistration,
} from './workspace-registry';

export const WORKSPACE_IDENTITY_RELATIVE_PATH = '.nevo/local/state/workspace-identity.json';

interface WorkspaceIdentityMarker {
  readonly version: 1;
  readonly projectId: string;
  readonly workspaceId: string;
  readonly instanceId: string;
}

/**
 * Explicit provisioning, before linked workspace registration. An exclusive,
 * durable local marker binds this particular checkout incarnation to the
 * planned registry record. A second attempt never replaces its identity.
 *
 * If the process dies between provisioning and registry publication, the
 * unregistered marker must be inspected/recovered explicitly. No automatic
 * adoption or replacement takes place.
 */
export async function provisionLinkedWorkspaceIdentity(
  context: ResolvedProjectHome,
  root: string,
  workspaceId: string,
  managed: boolean,
): Promise<WorkspaceRegistration> {
  if (root === context.project.homeRoot || !isIdentity(workspaceId)) {
    throw new WorkspaceRegistryError(
      'REGISTRY_CONFLICT',
      'A linked checkout requires a distinct root and valid workspace identity.',
    );
  }
  await verifyWorkspaceRoot(context, root);
  if (!(await isGitIgnored(root, WORKSPACE_IDENTITY_RELATIVE_PATH))) {
    throw new WorkspaceRegistryError(
      'REGISTRY_WORKSPACE_MISMATCH',
      'The linked identity marker must be ignored by Git.',
    );
  }

  const stateRoot = join(root, '.nevo/local/state');
  for (const dir of ['.nevo', '.nevo/local', '.nevo/local/state']) {
    const path = join(root, dir);
    try {
      await mkdir(path, { mode: 0o700 });
    } catch (error) {
      if (!isNodeError(error, 'EEXIST')) throw error;
    }
    const stat = await lstat(path);
    if (!stat.isDirectory() || stat.isSymbolicLink() || (await realpath(path)) !== path) {
      throw new WorkspaceRegistryError(
        'REGISTRY_WORKSPACE_MISMATCH',
        'Linked workspace identity directory is redirected or not a real directory.',
      );
    }
  }

  const marker: WorkspaceIdentityMarker = {
    version: 1,
    projectId: context.project.projectId,
    workspaceId,
    instanceId: randomUUID(),
  };
  const markerPath = join(stateRoot, 'workspace-identity.json');
  let handle;
  try {
    handle = await open(markerPath, 'wx', 0o600);
  } catch (error) {
    if (isNodeError(error, 'EEXIST')) {
      throw new WorkspaceRegistryError(
        'REGISTRY_CONFLICT',
        'A workspace identity marker already exists; recovery is required, not reassignment.',
      );
    }
    throw error;
  }
  try {
    await handle.writeFile(JSON.stringify(marker) + '\n', 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  return { workspaceId, kind: 'linked', root, managed, instanceId: marker.instanceId };
}

/** No marker creation on reads: a missing, corrupt, or substituted marker fails closed. */
export async function verifyLinkedWorkspaceIdentity(
  context: ResolvedProjectHome,
  registration: WorkspaceRegistration,
): Promise<void> {
  if (registration.kind === 'primary') return;
  const markerPath = join(registration.root, WORKSPACE_IDENTITY_RELATIVE_PATH);
  for (const relative of ['.nevo', '.nevo/local', '.nevo/local/state']) {
    const directory = join(registration.root, relative);
    try {
      const stat = await lstat(directory);
      if (!stat.isDirectory() || stat.isSymbolicLink() || (await realpath(directory)) !== directory) {
        throw new WorkspaceRegistryError(
          'REGISTRY_WORKSPACE_MISMATCH',
          'Registered linked workspace identity path was redirected.',
        );
      }
    } catch (error) {
      if (!isNodeError(error, 'ENOENT')) throw error;
      throw new WorkspaceRegistryError(
        'REGISTRY_WORKSPACE_MISMATCH',
        'Registered linked workspace identity directory is missing.',
      );
    }
  }
  let content: string;
  try {
    const stat = await lstat(markerPath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new WorkspaceRegistryError(
        'REGISTRY_WORKSPACE_MISMATCH',
        'Linked workspace identity marker is redirected or not a regular file.',
      );
    }
    content = await readFile(markerPath, 'utf8');
  } catch (error) {
    if (!isNodeError(error, 'ENOENT')) throw error;
    throw new WorkspaceRegistryError(
      'REGISTRY_WORKSPACE_MISMATCH',
      'Registered workspace incarnation marker is absent; possible replaced worktree.',
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    throw new WorkspaceRegistryError(
      'REGISTRY_WORKSPACE_MISMATCH',
      'Linked workspace incarnation marker is corrupt.',
    );
  }
  if (!(await isGitIgnored(registration.root, WORKSPACE_IDENTITY_RELATIVE_PATH))) {
    throw new WorkspaceRegistryError(
      'REGISTRY_WORKSPACE_MISMATCH',
      'Linked identity marker is no longer protected by Git ignore rules.',
    );
  }
  if (
    !isRecord(parsed) ||
    parsed.version !== 1 ||
    parsed.projectId !== context.project.projectId ||
    parsed.workspaceId !== registration.workspaceId ||
    parsed.instanceId !== registration.instanceId
  ) {
    throw new WorkspaceRegistryError(
      'REGISTRY_WORKSPACE_MISMATCH',
      'Linked workspace incarnation differs from the registered workspace identity.',
    );
  }
}

function isIdentity(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown, code: string): boolean {
  return isRecord(error) && error.code === code;
}
