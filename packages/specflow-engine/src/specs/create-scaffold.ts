import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { lstat, mkdir, open, readFile, realpath } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { createSpecificationScaffold, type SpecificationScaffold } from './model';
import { CreateOperationError, type CreateJournal } from './create-journal';

/** Durable scaffold contents are immutable until the operation completes. */
function expectedScaffold(record: CreateJournal): SpecificationScaffold {
  const scaffold = createSpecificationScaffold({
    specId: record.specId,
    title: record.title,
    created: record.created,
    goal: record.goal,
  });
  if (
    scaffold.slug !== record.slug ||
    !isDeepStrictEqual(
      scaffold.files.map((file) => ({ relativePath: file.relativePath, sha256: file.sha256 })),
      record.files,
    )
  ) {
    throw recovery('Scaffold evidence differs from immutable creation intent.');
  }
  return scaffold;
}

export async function writeScaffoldWithEvidence(record: CreateJournal): Promise<void> {
  const scaffold = expectedScaffold(record);
  for (const file of scaffold.files) {
    const absolute = join(record.target.workspaceRoot, file.relativePath);
    const parent = dirname(absolute);
    // No symlink or path redirection may alter the target after validation.
    for (const directory of [
      join(record.target.workspaceRoot, 'specs'),
      join(record.target.workspaceRoot, 'specs/active'),
      parent,
    ]) {
      try {
        await mkdir(directory);
      } catch (error) {
        if (!isExists(error)) throw error;
      }
      const stat = await lstat(directory);
      if (
        !stat.isDirectory() ||
        stat.isSymbolicLink() ||
        (await realpath(directory)) !== directory
      ) {
        throw recovery('Specification directory has been redirected.');
      }
    }
    try {
      const handle = await open(absolute, 'wx', 0o600);
      try {
        await handle.writeFile(file.content, 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }
    } catch (error) {
      if (!isExists(error)) throw error;
    }
    await verifyFile(absolute, file.sha256);
  }
}

export async function verifyScaffold(record: CreateJournal): Promise<void> {
  expectedScaffold(record);
  for (const file of record.files) {
    await verifyFile(join(record.target.workspaceRoot, file.relativePath), file.sha256);
  }
}

async function verifyFile(path: string, expectedHash: string): Promise<void> {
  let content: string;
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink()) throw recovery('Scaffold file was redirected.');
    content = await readFile(path, 'utf8');
  } catch {
    throw recovery('Scaffold evidence is missing or unreadable.');
  }
  if (sha256(content) !== expectedHash) {
    throw recovery('Scaffold was modified since the recorded creation intent.');
  }
}

export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function recovery(message: string): CreateOperationError {
  return new CreateOperationError('CREATE_RECOVERY_REQUIRED', message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isExists(error: unknown): boolean {
  return isRecord(error) && error.code === 'EEXIST';
}
