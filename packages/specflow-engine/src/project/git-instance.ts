import { randomUUID } from 'node:crypto';
import { lstat, open, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ProjectHomeError } from './project-home';

/**
 * Only physical-Git-instance evidence lives inside Git metadata.
 * Project Home configuration, registry, claims and secrets remain in .nevo/local.
 * This file is deliberately outside the worktree and is NOT committed.
 */
export const GIT_INSTANCE_SENTINEL_FILE = 'nevo-specflow-instance.json';

interface GitInstanceSentinel {
  readonly version: 1;
  readonly projectId: string;
  readonly instanceId: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export async function claimGitInstance(commonDir: string, projectId: string): Promise<string> {
  const instanceId = randomUUID();
  const sentinel: GitInstanceSentinel = { version: 1, projectId, instanceId };
  const path = join(commonDir, GIT_INSTANCE_SENTINEL_FILE);
  let handle;
  try {
    handle = await open(path, 'wx', 0o600);
  } catch (error) {
    if (isNodeError(error, 'EEXIST')) {
      throw new ProjectHomeError(
        'PROJECT_HOME_INVALID',
        'Git instance was previously claimed; explicit recovery is required.',
      );
    }
    throw error;
  }

  try {
    await handle.writeFile(JSON.stringify(sentinel) + '\n', 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  return instanceId;
}

export async function verifyGitInstance(
  commonDir: string,
  projectId: string,
  instanceId: string,
): Promise<void> {
  const path = join(commonDir, GIT_INSTANCE_SENTINEL_FILE);
  let parsed: unknown;
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error('Git instance sentinel must be a regular file.');
    }
    parsed = JSON.parse(await readFile(path, 'utf8')) as unknown;
  } catch {
    throw new ProjectHomeError(
      'PROJECT_HOME_MISMATCH',
      'Git instance evidence is missing, corrupt or redirected; explicit recovery is required.',
    );
  }
  if (
    !isRecord(parsed) ||
    parsed.version !== 1 ||
    parsed.projectId !== projectId ||
    parsed.instanceId !== instanceId ||
    !UUID_PATTERN.test(instanceId)
  ) {
    throw new ProjectHomeError(
      'PROJECT_HOME_MISMATCH',
      'Git repository incarnation no longer matches its Project Home designation.',
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown, code: string): boolean {
  return isRecord(error) && error.code === code;
}
