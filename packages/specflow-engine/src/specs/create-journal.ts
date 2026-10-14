import { lstat, mkdir, readFile, readdir, realpath } from 'node:fs/promises';
import { join } from 'node:path';

import { writeJsonAtomically } from '../project/atomic-json';
import { withProjectControlLock } from '../project/control-lock';
import type { ResolvedProjectHome } from '../project/project-home';

export const CREATE_JOURNAL_RELATIVE_DIR = 'engine/operations/create';

export const CREATE_STAGES = [
  'reserved',
  'git-initiated',
  'git-provisioned',
  'manifest-writing',
  'manifest-written',
  'registry-writing',
  'registry-linked',
  'completed',
  'recovery-required',
] as const;

export type CreateStage = (typeof CREATE_STAGES)[number];

export interface CreateJournalTarget {
  readonly kind: 'existing' | 'new-worktree';
  readonly workspaceId: string;
  readonly workspaceRoot: string;
  readonly branch?: string;
  readonly baseCommit?: string;
  readonly instanceId?: string;
}

export interface CreateJournalFile {
  readonly relativePath: string;
  readonly sha256: string;
}

export interface CreateJournal {
  readonly version: 1;
  readonly projectId: string;
  readonly operationId: string;
  readonly inputFingerprint: string;
  readonly specId: string;
  readonly slug: string;
  readonly title: string;
  readonly created: string;
  readonly goal?: string;
  readonly stage: CreateStage;
  readonly target: CreateJournalTarget;
  readonly files: readonly CreateJournalFile[];
  readonly reason?: string;
}

export type CreateOperationErrorCode =
  | 'CREATE_CONFLICT'
  | 'CREATE_RECOVERY_REQUIRED'
  | 'CREATE_OPERATION_INVALID'
  | 'CREATE_JOURNAL_CORRUPT';

export class CreateOperationError extends Error {
  readonly code: CreateOperationErrorCode;

  constructor(code: CreateOperationErrorCode, message: string) {
    super(message);
    this.name = 'CreateOperationError';
    this.code = code;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256 = /^[0-9a-f]{64}$/u;

export function validateOperationId(id: string): void {
  if (!UUID.test(id)) {
    throw new CreateOperationError('CREATE_OPERATION_INVALID', 'A UUID operationId is required.');
  }
}

export function createJournalPath(context: ResolvedProjectHome, operationId: string): string {
  validateOperationId(operationId);
  return join(context.project.stateRoot, CREATE_JOURNAL_RELATIVE_DIR, operationId + '.json');
}

export async function readCreateJournal(
  context: ResolvedProjectHome,
  operationId: string,
): Promise<CreateJournal | undefined> {
  const path = createJournalPath(context, operationId);
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 65536) {
      throw invalidJournal();
    }
    const parsed = JSON.parse(await readFile(path, 'utf8')) as unknown;
    return parseJournal(context, parsed, operationId);
  } catch (error) {
    if (isMissing(error)) return undefined;
    if (error instanceof SyntaxError) throw invalidJournal();
    throw error;
  }
}

export async function listCreateJournals(
  context: ResolvedProjectHome,
): Promise<readonly CreateJournal[]> {
  const path = join(context.project.stateRoot, CREATE_JOURNAL_RELATIVE_DIR);
  try {
    const stat = await lstat(path);
    if (!stat.isDirectory() || stat.isSymbolicLink() || (await realpath(path)) !== path) {
      throw invalidJournal();
    }
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }
  const files = await readdir(path, { withFileTypes: true });
  const records: CreateJournal[] = [];
  for (const file of files) {
    if (!file.isFile() || file.isSymbolicLink() || !file.name.endsWith('.json')) {
      throw invalidJournal();
    }
    const operationId = file.name.slice(0, -5);
    validateOperationId(operationId);
    const record = await readCreateJournal(context, operationId);
    if (!record) throw invalidJournal();
    records.push(record);
  }
  return records;
}

export async function withCreateJournalLock<T>(
  context: ResolvedProjectHome,
  action: () => Promise<T>,
): Promise<T> {
  return withProjectControlLock(
    context,
    async () => {
      // Every ancestor is checked, including the journal's ignored local state.
      let root = context.project.stateRoot;
      const state = await lstat(root);
      if (!state.isDirectory() || state.isSymbolicLink() || (await realpath(root)) !== root) {
        throw invalidJournal();
      }
      for (const segment of ['engine', 'operations', 'create']) {
        root = join(root, segment);
        try {
          await mkdir(root, { mode: 0o700 });
        } catch (error) {
          if (!isExists(error)) throw error;
        }
        const stat = await lstat(root);
        if (!stat.isDirectory() || stat.isSymbolicLink() || (await realpath(root)) !== root) {
          throw invalidJournal();
        }
      }
      return action();
    },
    { waitMs: 25000 },
  );
}

/** Caller MUST hold the Project Home control lock. */
export async function publishCreateJournal(
  context: ResolvedProjectHome,
  record: CreateJournal,
): Promise<void> {
  parseJournal(context, record, record.operationId);
  await writeJsonAtomically(createJournalPath(context, record.operationId), record);
}

function parseJournal(
  context: ResolvedProjectHome,
  value: unknown,
  operationId: string,
): CreateJournal {
  if (
    !isRecord(value) ||
    !isValidJournalIdentity(context, value, operationId) ||
    !isValidJournalTarget(value.target) ||
    !isValidJournalFiles(value.files, value.slug)
  ) {
    throw invalidJournal();
  }
  // Each part has been validated without changing the serialized record.
  return value as unknown as CreateJournal;
}

function isValidJournalIdentity(
  context: ResolvedProjectHome,
  value: Record<string, unknown>,
  operationId: string,
): boolean {
  return (
    value.version === 1 &&
    value.projectId === context.project.projectId &&
    value.operationId === operationId &&
    UUID.test(operationId) &&
    typeof value.inputFingerprint === 'string' &&
    SHA256.test(value.inputFingerprint) &&
    typeof value.specId === 'string' &&
    UUID.test(value.specId) &&
    typeof value.slug === 'string' &&
    typeof value.title === 'string' &&
    typeof value.created === 'string' &&
    (value.goal === undefined || typeof value.goal === 'string') &&
    isCreateStage(value.stage) &&
    (value.reason === undefined || typeof value.reason === 'string')
  );
}

function isCreateStage(value: unknown): value is CreateStage {
  return typeof value === 'string' && CREATE_STAGES.some((stage) => stage === value);
}

function isValidJournalTarget(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.kind !== 'existing' && value.kind !== 'new-worktree') return false;
  if (
    typeof value.workspaceId !== 'string' ||
    !UUID.test(value.workspaceId) ||
    typeof value.workspaceRoot !== 'string' ||
    (value.instanceId !== undefined &&
      (typeof value.instanceId !== 'string' || !UUID.test(value.instanceId)))
  ) {
    return false;
  }
  if (value.kind === 'existing') return true;
  return (
    typeof value.branch === 'string' &&
    typeof value.baseCommit === 'string' &&
    /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/iu.test(value.baseCommit)
  );
}

function isValidJournalFiles(value: unknown, slug: unknown): boolean {
  if (!Array.isArray(value) || value.length !== 2 || typeof slug !== 'string') return false;
  return (
    value.every(
      (file: unknown) =>
        isRecord(file) &&
        typeof file.relativePath === 'string' &&
        typeof file.sha256 === 'string' &&
        SHA256.test(file.sha256),
    ) &&
    isRecord(value[0]) &&
    value[0].relativePath === 'specs/active/' + slug + '/change.yaml' &&
    isRecord(value[1]) &&
    value[1].relativePath === 'specs/active/' + slug + '/overview.md'
  );
}

function invalidJournal(): CreateOperationError {
  return new CreateOperationError(
    'CREATE_JOURNAL_CORRUPT',
    'Create operation journal is corrupt or redirected. Explicit recovery is required.',
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMissing(error: unknown): boolean {
  return isRecord(error) && error.code === 'ENOENT';
}

function isExists(error: unknown): boolean {
  return isRecord(error) && error.code === 'EEXIST';
}
