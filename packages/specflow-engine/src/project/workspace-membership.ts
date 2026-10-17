import { realpath } from 'node:fs/promises';
import { isAbsolute } from 'node:path';

import { resolveProjectHome, type ResolvedProjectHome } from './project-home';
import { WorkspaceRegistryError } from './workspace-registry-types';

/** Git and Project Home admission without linked-marker verification. */
export async function verifyWorkspaceMembership(
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

function isMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
