import { randomUUID } from 'node:crypto';
import { lstat, open, realpath, rename, rm } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

/**
 * Local-filesystem atomic JSON publication. Requires an externally held short
 * transaction lock for read/modify/write. Never deletes the old destination as
 * a Windows rename workaround.
 */
export async function writeJsonAtomically(
  path: string,
  document: unknown,
  options: { readonly beforePublish?: () => Promise<void> } = {},
): Promise<void> {
  const parent = dirname(path);
  const parentStat = await lstat(parent);
  if (
    !parentStat.isDirectory() ||
    parentStat.isSymbolicLink() ||
    (await realpath(parent)) !== parent
  ) {
    throw new Error('Atomic record directory must be an existing physical directory.');
  }

  try {
    const existing = await lstat(path);
    if (!existing.isFile() || existing.isSymbolicLink()) {
      throw new Error('Refusing to overwrite a nonregular or symlinked state record.');
    }
  } catch (error) {
    if (!isNodeError(error, 'ENOENT')) throw error;
  }

  const staged = join(parent, `.${basename(path)}.${randomUUID()}.tmp`);
  let published = false;
  try {
    const handle = await open(staged, 'wx', 0o600);
    try {
      await handle.writeFile(JSON.stringify(document, null, 2) + '\n', 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }

    // The last durable old snapshot stays readable until this rename.
    await options.beforePublish?.();
    await rename(staged, path);
    published = true;
    await syncDirectoryWhenSupported(parent);
  } finally {
    if (!published) {
      // An ordinary exception removes its own stage file. SIGKILL/power failure
      // leaves evidence, never a silently-published partial registry.
      await rm(staged, { force: true });
    }
  }
}

async function syncDirectoryWhenSupported(path: string): Promise<void> {
  // POSIX directory fsync helps persist the rename across power loss. On
  // Windows, opening/syncing a directory can be unsupported by Node/NTFS.
  let dir;
  try {
    dir = await open(path, 'r');
    await dir.sync();
  } catch (error) {
    if (
      process.platform !== 'win32' ||
      !['EISDIR', 'EPERM', 'EACCES', 'EINVAL', 'EBADF'].some((code) => isNodeError(error, code))
    ) {
      throw error;
    }
  } finally {
    await dir?.close();
  }
}

function isNodeError(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}
