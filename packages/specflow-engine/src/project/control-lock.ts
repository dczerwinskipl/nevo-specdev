import { randomUUID } from 'node:crypto';
import { channel } from 'node:diagnostics_channel';
import { lstat, mkdir, open, readFile, realpath, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';

import { resolveProjectHome, type ResolvedProjectHome } from './project-home';

export const PROJECT_CONTROL_LOCK_RELATIVE_PATH = 'engine/control.lock';

// Subscribers can profile contention without modifying the coordinated operation.
const lockTimingChannel = channel('nevo.specflow.engine.control-lock');

export type ProjectControlLockErrorCode =
  | 'CONTROL_LOCK_BUSY'
  | 'CONTROL_LOCK_CORRUPT'
  | 'CONTROL_LOCK_OWNERSHIP_LOST'
  | 'CONTROL_LOCK_INVALID_HOME';

export class ProjectControlLockError extends Error {
  readonly code: ProjectControlLockErrorCode;

  constructor(code: ProjectControlLockErrorCode, message: string) {
    super(message);
    this.name = 'ProjectControlLockError';
    this.code = code;
  }
}

interface ControlLockRecord {
  readonly version: 1;
  readonly projectId: string;
  readonly token: string;
  readonly pid: number;
  readonly createdAt: string;
}

export type ProjectControlLockInspection =
  | { readonly status: 'free' }
  | {
      readonly status: 'held';
      readonly pid: number;
      readonly createdAt: string;
      /** A PID is only diagnostic, not a proof that an external writer ended. */
    }
  | { readonly status: 'corrupt'; readonly reason: string };

export interface ProjectControlLockOptions {
  /** Maximum time to wait for another short writer; never steals an orphan lock. */
  readonly waitMs?: number;
  readonly retryMs?: number;
}

export function projectControlLockPath(context: ResolvedProjectHome): string {
  return join(context.project.stateRoot, PROJECT_CONTROL_LOCK_RELATIVE_PATH);
}

/** Read-only diagnostics. No age-, PID- or TTL-based lock stealing is supported. */
export async function inspectProjectControlLock(
  context: ResolvedProjectHome,
): Promise<ProjectControlLockInspection> {
  const path = projectControlLockPath(context);
  let source: string;
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      return { status: 'corrupt', reason: 'Control lock is not a regular file.' };
    }
    source = await readFile(path, 'utf8');
  } catch (error) {
    if (isNodeError(error, 'ENOENT')) return { status: 'free' };
    throw error;
  }
  let value: unknown;
  try {
    value = JSON.parse(source) as unknown;
  } catch {
    return { status: 'corrupt', reason: 'Control lock metadata is incomplete or invalid.' };
  }
  if (!isLockRecord(value) || value.projectId !== context.project.projectId) {
    return { status: 'corrupt', reason: 'Control lock has invalid owner/project identity.' };
  }
  return { status: 'held', pid: value.pid, createdAt: value.createdAt };
}

/**
 * One deterministic, OS-process exclusive lock per verified Project Home.
 * Exclusive file creation admits exactly one process. Files left after process
 * death are never removed by timeout; explicit lock recovery is a later gate.
 */
export async function withProjectControlLock<T>(
  context: ResolvedProjectHome,
  action: () => Promise<T>,
  options: ProjectControlLockOptions = {},
): Promise<T> {
  await assertCurrentProjectHome(context);
  const dir = join(context.project.stateRoot, 'engine');
  await ensureSafeLockDirectory(context, dir);
  const path = projectControlLockPath(context);
  const token = randomUUID();
  const record: ControlLockRecord = {
    version: 1,
    projectId: context.project.projectId,
    token,
    pid: process.pid,
    createdAt: new Date().toISOString(),
  };
  const waitMs = options.waitMs ?? 5000;
  const retryMs = options.retryMs ?? 25;
  if (
    !Number.isSafeInteger(waitMs) ||
    !Number.isSafeInteger(retryMs) ||
    waitMs < 0 ||
    retryMs < 1
  ) {
    throw new ProjectControlLockError('CONTROL_LOCK_INVALID_HOME', 'Invalid lock wait settings.');
  }
  const deadline = Date.now() + waitMs;
  const measuring = lockTimingChannel.hasSubscribers;
  const startedAt = measuring ? performance.now() : 0;
  let acquiredAt = 0;
  let file;
  while (true) {
    try {
      file = await open(path, 'wx', 0o600);
      if (measuring) acquiredAt = performance.now();
      break;
    } catch (error) {
      // Windows may report EPERM instead of EEXIST while another process
      // holds an exclusively created lock file. Only treat it as contention
      // when lstat proves the lock path is an existing regular file; a missing
      // path or a permission error with no such proof remains a hard failure.
      const busy =
        isNodeError(error, 'EEXIST') ||
        (process.platform === 'win32' &&
          isNodeError(error, 'EPERM') &&
          (await isExistingRegularLock(path)));
      if (!busy) throw error;
      if (Date.now() >= deadline) {
        const inspected = await inspectProjectControlLock(context);
        throw new ProjectControlLockError(
          inspected.status === 'corrupt' ? 'CONTROL_LOCK_CORRUPT' : 'CONTROL_LOCK_BUSY',
          inspected.status === 'corrupt'
            ? 'Control lock needs explicit recovery. No automatic lock deletion is safe.'
            : 'Another process owns the project control lock; retry after it settles.',
        );
      }
      await sleep(Math.min(retryMs, Math.max(1, deadline - Date.now())));
    }
  }

  try {
    // If killed between exclusive create and durable metadata publication, a
    // partial lock remains as recovery-required rather than becoming free.
    await file.writeFile(JSON.stringify(record) + '\n', 'utf8');
    await file.sync();
    await file.close();

    const outcome = await (async () => {
      await assertCurrentProjectHome(context);
      return action();
    })().then(
      (value) => ({ success: true as const, value }),
      (error: unknown) => ({ success: false as const, error }),
    );

    let releaseFailure: unknown;
    try {
      await releaseOwnedLock(path, token);
    } catch (error) {
      releaseFailure = error;
    }
    // Publish only after releasing the file; diagnostics must never break an operation.
    if (measuring) {
      try {
        lockTimingChannel.publish({
          projectId: context.project.projectId,
          waitMs: acquiredAt - startedAt,
          heldMs: performance.now() - acquiredAt,
          released: releaseFailure === undefined,
        });
      } catch {
        // Diagnostic subscribers are untrusted observers, not lock participants.
      }
    }
    if (releaseFailure !== undefined) {
      if (!outcome.success) {
        throw new AggregateError(
          [outcome.error, releaseFailure],
          'Operation failed and its control lock could not be released safely.',
        );
      }
      if (releaseFailure instanceof Error) throw releaseFailure;
      throw new Error('Control lock release failed with a non-Error value.', {
        cause: releaseFailure,
      });
    }
    if (!outcome.success) throw outcome.error;
    return outcome.value;
  } catch (error) {
    // A failed metadata write leaves a visible recovery artifact. Do not
    // silently unlink a possibly-published lock after an uncertain failure.
    await file.close().catch(() => undefined);
    throw error;
  }
}

async function isExistingRegularLock(path: string): Promise<boolean> {
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new ProjectControlLockError(
        'CONTROL_LOCK_CORRUPT',
        'Control lock is not a regular file. Explicit recovery is required.',
      );
    }
    return true;
  } catch (error) {
    if (isNodeError(error, 'ENOENT')) return false;
    throw error;
  }
}

async function releaseOwnedLock(path: string, token: string): Promise<void> {
  // Do not unlink a path replaced by another actor. Cooperative same-OS
  // account processes do not modify one another's lock files.
  let existing: unknown;
  try {
    existing = JSON.parse(await readFile(path, 'utf8')) as unknown;
  } catch {
    throw new ProjectControlLockError(
      'CONTROL_LOCK_OWNERSHIP_LOST',
      'Control lock is unreadable; refusing to release an unknown owner.',
    );
  }
  if (!isLockRecord(existing) || existing.token !== token) {
    throw new ProjectControlLockError(
      'CONTROL_LOCK_OWNERSHIP_LOST',
      'Control lock ownership changed; refusing to release another writer.',
    );
  }
  await unlink(path);
}

async function ensureSafeLockDirectory(context: ResolvedProjectHome, dir: string): Promise<void> {
  const state = await lstat(context.project.stateRoot);
  if (!state.isDirectory() || state.isSymbolicLink()) {
    throw new ProjectControlLockError(
      'CONTROL_LOCK_INVALID_HOME',
      'Project state root must be a physical directory.',
    );
  }
  if ((await realpath(context.project.stateRoot)) !== context.project.stateRoot) {
    throw new ProjectControlLockError(
      'CONTROL_LOCK_INVALID_HOME',
      'Project state root changed or is redirected.',
    );
  }
  try {
    await mkdir(dir, { mode: 0o700 });
  } catch (error) {
    if (!isNodeError(error, 'EEXIST')) throw error;
  }
  const stat = await lstat(dir);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (await realpath(dir)) !== dir) {
    throw new ProjectControlLockError(
      'CONTROL_LOCK_INVALID_HOME',
      'Project control directory must not be a symlink or redirected path.',
    );
  }
}

async function assertCurrentProjectHome(context: ResolvedProjectHome): Promise<void> {
  try {
    const current = await resolveProjectHome({
      cwd: context.workspace.root,
      projectRoot: context.project.homeRoot,
    });
    if (
      current.project.projectId !== context.project.projectId ||
      current.project.gitCommonDir !== context.project.gitCommonDir ||
      current.project.stateRoot !== context.project.stateRoot
    ) {
      throw new ProjectControlLockError(
        'CONTROL_LOCK_INVALID_HOME',
        'Project Home identity changed; refuse to coordinate under the old state root.',
      );
    }
  } catch (error) {
    if (error instanceof ProjectControlLockError) throw error;
    throw new ProjectControlLockError(
      'CONTROL_LOCK_INVALID_HOME',
      'Project Home cannot be revalidated before a coordinated mutation.',
    );
  }
}

function isLockRecord(value: unknown): value is ControlLockRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  return (
    obj.version === 1 &&
    typeof obj.projectId === 'string' &&
    typeof obj.token === 'string' &&
    /^[0-9a-f-]{36}$/iu.test(obj.token) &&
    Number.isSafeInteger(obj.pid) &&
    (obj.pid as number) > 0 &&
    typeof obj.createdAt === 'string' &&
    !Number.isNaN(Date.parse(obj.createdAt))
  );
}

function isNodeError(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}
