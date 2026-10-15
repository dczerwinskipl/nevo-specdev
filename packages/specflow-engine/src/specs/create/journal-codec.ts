import {
  fingerprintCreateClientIntent,
  normalizeCreateClientIntent,
  type CreateClientIntent,
} from '../create-intent';
import { CreateOperationError } from '../create-error';
import type { ResolvedProjectHome } from '../../project/project-home';
import { CREATE_STAGES, type CreateJournal, type CreateStage } from './journal-model';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256 = /^[0-9a-f]{64}$/u;

export function parseCreateJournal(
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

export function invalidJournal(): CreateOperationError {
  return new CreateOperationError(
    'CREATE_JOURNAL_CORRUPT',
    'Create operation journal is corrupt or redirected. Explicit recovery is required.',
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
