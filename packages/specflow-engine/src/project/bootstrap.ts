import { randomUUID } from 'node:crypto';
import { lstat, mkdir, open, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { openSpecFlowEngine, type SpecFlowEngine } from '../application';
import {
  isGitIgnored,
  LOCAL_CONFIG_RELATIVE_PATH,
  PROJECT_CONFIG_RELATIVE_PATH,
  resolveGitCheckoutLayout,
  runGit,
} from './git-checkout';
import {
  PROJECT_HOME_MARKER_RELATIVE_PATH,
  ProjectHomeError,
  resolveProjectHome,
} from './project-home';
import { initializeWorkspaceRegistry } from './registry-store';
import { claimGitInstance } from './git-instance';

/**
 * Explicitly designate a previously unclaimed primary Git checkout.
 * Existing registry/markers are never adopted, overwritten or reconstructed.
 * Failure after marker publication leaves durable recovery evidence; retry
 * must NOT invent another projectId or primaryWorkspaceId.
 */
export async function bootstrapProjectHome(cwd: string): Promise<SpecFlowEngine> {
  const { root, physicalCommonDir } = await inspectPrimaryGitCheckout(cwd);

  try {
    await resolveProjectHome({ cwd: root });
    throw new ProjectHomeError(
      'PROJECT_HOME_INVALID',
      'Project Home is already designated; open it instead of bootstrapping again.',
    );
  } catch (error) {
    if (!(error instanceof ProjectHomeError) || error.code !== 'PROJECT_HOME_NOT_FOUND') {
      throw error;
    }
  }

  const config = await lstat(join(root, PROJECT_CONFIG_RELATIVE_PATH));
  if (!config.isFile() || config.isSymbolicLink()) {
    throw new ProjectHomeError(
      'PROJECT_HOME_INVALID',
      'Project configuration must be a regular file.',
    );
  }

  for (const relative of [
    LOCAL_CONFIG_RELATIVE_PATH,
    PROJECT_HOME_MARKER_RELATIVE_PATH,
    '.nevo/local/state/workspaces.json',
    '.nevo/local/state/engine/claims/probe.json',
    '.nevo/local/state/runtime/sessions/probe.json',
  ]) {
    if (!(await isGitIgnored(root, relative))) {
      throw new ProjectHomeError(
        'PROJECT_HOME_INVALID',
        'Refusing to persist workstation-local state outside Git ignore: ' + relative,
      );
    }
  }

  for (const relative of ['.nevo', '.nevo/local', '.nevo/local/state']) {
    const path = join(root, relative);
    try {
      await mkdir(path, { mode: 0o700 });
    } catch (error) {
      if (!isExists(error)) throw error;
    }
    const stat = await lstat(path);
    if (!stat.isDirectory() || stat.isSymbolicLink() || (await realpath(path)) !== path) {
      throw new ProjectHomeError(
        'PROJECT_HOME_INVALID',
        'Project Home state directory must not be redirected: ' + relative,
      );
    }
  }

  const registryPath = join(root, '.nevo/local/state/workspaces.json');
  try {
    await lstat(registryPath);
    throw new ProjectHomeError(
      'PROJECT_HOME_INVALID',
      'Undesignated existing registry requires explicit recovery; refusing a new identity.',
    );
  } catch (error) {
    if (!isMissing(error)) throw error;
  }

  // Claim the physical Git instance before publishing its Project Home marker.
  // A crash after this point needs explicit recovery; never silently adopt it.
  const projectId = randomUUID();
  const gitInstanceId = await claimGitInstance(physicalCommonDir, projectId);

  const markerPath = join(root, PROJECT_HOME_MARKER_RELATIVE_PATH);
  let handle;
  try {
    handle = await open(markerPath, 'wx', 0o600);
  } catch (error) {
    if (isExists(error)) {
      throw new ProjectHomeError(
        'PROJECT_HOME_INVALID',
        'Project Home marker already exists; explicit recovery is required.',
      );
    }
    throw error;
  }
  try {
    await handle.writeFile(
      JSON.stringify({
        version: 1,
        projectId,
        homeRoot: root,
        gitCommonDir: physicalCommonDir,
        gitInstanceId,
        registryBootstrap: 'fresh',
      }) + '\n',
      'utf8',
    );
    await handle.sync();
  } finally {
    await handle.close();
  }

  const context = await resolveProjectHome({ cwd: root });
  await initializeWorkspaceRegistry(context);
  return openSpecFlowEngine({ cwd: root });
}

/** Read-only admission before CLI init wizard or any config/.gitignore mutation. */
export async function assertPrimaryGitCheckout(cwd: string): Promise<void> {
  await inspectPrimaryGitCheckout(cwd);
}

async function inspectPrimaryGitCheckout(
  cwd: string,
): Promise<{ root: string; physicalCommonDir: string }> {
  const layout = await resolveGitCheckoutLayout(cwd);
  const root = layout.root;
  const [gitDir, commonDir] = await Promise.all([
    runGit(root, ['rev-parse', '--git-dir']),
    runGit(root, ['rev-parse', '--git-common-dir']),
  ]);
  if (
    gitDir.code !== 0 ||
    commonDir.code !== 0 ||
    !gitDir.stdout.trim() ||
    !commonDir.stdout.trim()
  ) {
    throw new ProjectHomeError('PROJECT_HOME_INVALID', 'Cannot verify primary Git checkout.');
  }
  const physicalGitDir = await realpath(resolve(root, gitDir.stdout.trim()));
  const physicalCommonDir = await realpath(resolve(root, commonDir.stdout.trim()));
  if (physicalGitDir !== physicalCommonDir) {
    throw new ProjectHomeError(
      'PROJECT_HOME_INVALID',
      'Only the primary Git checkout can become Project Home.',
    );
  }
  return { root, physicalCommonDir };
}

function isMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

function isExists(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST';
}
