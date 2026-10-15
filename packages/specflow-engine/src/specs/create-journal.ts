import { lstat, mkdir, readFile, readdir, realpath } from 'node:fs/promises';
import { join } from 'node:path';

import {
  fingerprintCreateClientIntent,
  normalizeCreateClientIntent,
  type CreateClientIntent,
} from './create-intent';
import { CreateOperationError } from './create-error';
export { CreateOperationError, type CreateOperationErrorCode } from './create-error';

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

export interface ExistingJournalTarget {
  readonly kind: 'existing';
  readonly workspaceId: string;
  readonly workspaceRoot: string;
}

export interface NewWorktreeJournalTarget {
  readonly kind: 'new-worktree';
  readonly workspaceId: string;
  readonly workspaceRoot: string;
  readonly branch: string;
  readonly baseCommit: string;
  /** v1 journals may predate physical workspace identity markers. */
  readonly instanceId?: string;
}

export type CreateJournalTarget = ExistingJournalTarget | NewWorktreeJournalTarget;

/** v2 reservations pin the physical checkout identity before publication. */
export type CreateJournalV2Target =
  | ExistingJournalTarget
  | (NewWorktreeJournalTarget & { readonly instanceId: string });

export interface CreateJournalFile {
  readonly relativePath: string;
  readonly sha256: string;
}

export interface CreateJournalFields<TTarget extends CreateJournalTarget = CreateJournalTarget> {
  readonly projectId: string;
  readonly operationId: string;
  readonly inputFingerprint: string;
  readonly specId: string;
  readonly slug: string;
  readonly title: string;
  readonly created: string;
  readonly goal?: string;
  readonly stage: CreateStage;
  readonly target: TTarget;
  readonly files: readonly CreateJournalFile[];
  readonly reason?: string;
}

export interface CreateJournalV1 extends CreateJournalFields {
  readonly version: 1;
}

export interface CreateJournalV2 extends CreateJournalFields<CreateJournalV2Target> {
  readonly version: 2;
  readonly requestIntent: CreateClientIntent;
  readonly gitPlan?: { readonly projectRoot: string; readonly gitInstanceId: string };
}

export type CreateJournal = CreateJournalV1 | CreateJournalV2;

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
  if (record.version === 1) {
    // A historical journal may advance stages, but new v1 reservations are
    // forbidden after the v2 transport/writer cutover.
    const previous = await readCreateJournal(context, record.operationId);
    if (previous?.version !== 1) {
      throw new CreateOperationError(
        'CREATE_RECOVERY_REQUIRED',
        'A new v1 reservation cannot be published after VC05.',
      );
    }
  }
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
    !isValidJournalTarget(value.target, value.version) ||
    !isValidJournalFiles(value.files, value.slug) ||
    (value.version === 2 && !isValidV2Journal(context, value))
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
    (value.version === 1 || value.version === 2) &&
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

function isValidJournalTarget(value: unknown, version: unknown): boolean {
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
    (version !== 2 || (typeof value.instanceId === 'string' && UUID.test(value.instanceId))) &&
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

/** Strict v2 evidence shape: no hidden current defaults or generated date in intent. */
function isValidV2Journal(context: ResolvedProjectHome, value: Record<string, unknown>): boolean {
  const intent = value.requestIntent;
  const plan = value.gitPlan;
  if (
    !isRecord(intent) ||
    typeof intent.title !== 'string' ||
    intent.title !== value.title ||
    (intent.goal !== undefined && typeof intent.goal !== 'string') ||
    intent.goal !== value.goal ||
    !isRecord(intent.target) ||
    Object.keys(intent).some((key) => key !== 'title' && key !== 'goal' && key !== 'target')
  ) {
    return false;
  }
  const target = intent.target;
  if (target.kind === 'existing') {
    if (
      !isRecord(value.target) ||
      value.target.kind !== 'existing' ||
      target.workspaceId !== value.target.workspaceId ||
      plan !== undefined ||
      Object.keys(target).some((key) => key !== 'kind' && key !== 'workspaceId')
    ) {
      return false;
    }
  } else if (target.kind === 'new-worktree') {
    if (
      !isRecord(value.target) ||
      value.target.kind !== 'new-worktree' ||
      !isClientOverride(target.baseRef) ||
      !isClientOverride(target.branch) ||
      Object.keys(target).some((key) => key !== 'kind' && key !== 'baseRef' && key !== 'branch') ||
      !isRecord(plan) ||
      typeof plan.projectRoot !== 'string' ||
      plan.projectRoot !== context.project.homeRoot ||
      plan.gitInstanceId !== context.project.gitInstanceId ||
      Object.keys(plan).some((key) => key !== 'projectRoot' && key !== 'gitInstanceId')
    ) {
      return false;
    }
  } else {
    return false;
  }
  if (typeof value.inputFingerprint !== 'string') return false;
  const persisted = intent as unknown as CreateClientIntent;
  try {
    const normalized = normalizeCreateClientIntent({
      title: persisted.title,
      goal: persisted.goal,
      target:
        persisted.target.kind === 'existing'
          ? persisted.target
          : {
              kind: 'new-worktree',
              ...(persisted.target.baseRef.kind === 'explicit'
                ? { baseRef: persisted.target.baseRef.value }
                : {}),
              ...(persisted.target.branch.kind === 'explicit'
                ? { branch: persisted.target.branch.value }
                : {}),
            },
    });
    return (
      JSON.stringify(normalized) === JSON.stringify(persisted) &&
      fingerprintCreateClientIntent(normalized) === value.inputFingerprint
    );
  } catch {
    return false;
  }
}

function isClientOverride(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.kind === 'omitted') return Object.keys(value).length === 1;
  return (
    value.kind === 'explicit' &&
    typeof value.value === 'string' &&
    value.value.length > 0 &&
    Object.keys(value).length === 2
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
