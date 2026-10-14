import { randomUUID } from 'node:crypto';
import { lstat, mkdir, realpath } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { SpecFlowEngine } from '../application';
import { openGitCapability } from '../git/capability';
import { executeGitMutation } from '../git/mutation';
import { inspectRegisteredWorkspace } from '../project/workspace-registry';
import {
  createSpecificationScaffold,
  isValidSpecificationId,
  validateSpecificationScaffoldInput,
} from './model';
import { commitBinding } from './create-binding';
import {
  ensureLinkedIdentity,
  inspectPlannedGitEffect,
  requireRegisteredTarget,
  requireTargetIdentity,
  validateNewGitReservation,
} from './create-git';
import { sha256, verifyScaffold, writeScaffoldWithEvidence } from './create-scaffold';
import { discoverSpecifications } from './discovery';
import { readWorkspaceSpecification } from './repository';
import {
  CreateOperationError,
  listCreateJournals,
  publishCreateJournal,
  readCreateJournal,
  validateOperationId,
  withCreateJournalLock,
  type CreateJournal,
  type CreateStage,
} from './create-journal';

export type CreateSpecificationTarget =
  | { readonly kind: 'existing'; readonly workspaceId: string }
  | {
      readonly kind: 'new-worktree';
      readonly baseRef: string;
      readonly branch?: string;
    };

export interface CreateSpecificationInput {
  readonly operationId: string;
  readonly title: string;
  readonly created: string;
  readonly goal?: string;
  readonly target: CreateSpecificationTarget;
}

export interface CreatedSpecification {
  readonly operationId: string;
  readonly specId: string;
  readonly slug: string;
  readonly workspaceId: string;
  readonly workspaceRoot: string;
  readonly relativeManifestPath: string;
}

export interface CreateSpecificationOptions {
  /**
   * Explicit operator assertion that an interrupted mutating Git process is
   * no longer running. Without this, git-initiated is never replayed.
   * The Engine still verifies exact ref/path/HEAD and fails closed on mismatch.
   */
  readonly confirmInterruptedGitSettled?: boolean;
  /** Internal test hook only; adapters must never expose this to HTTP callers. */
  readonly afterEffect?: (effect: 'reservation' | 'git' | 'manifest' | 'registry') => Promise<void>;
}

export async function inspectCreateSpecification(
  engine: SpecFlowEngine,
  operationId: string,
): Promise<CreateJournal | undefined> {
  await engine.readRegistry();
  return readCreateJournal(engine.context, operationId);
}

/**
 * Offline, idempotent create use case. The Engine alone owns Git/FS/registry
 * mutations: HTTP/CLI will only adapt and authorize this operation in E2.T05.
 */
export async function createSpecification(
  engine: SpecFlowEngine,
  input: CreateSpecificationInput,
  options: CreateSpecificationOptions = {},
): Promise<CreatedSpecification> {
  validateOperationId(input.operationId);
  const normalized = normalize(input);
  const fingerprint = sha256(JSON.stringify(normalized));
  let record = await reserve(engine, normalized, input.operationId, fingerprint);
  // The journal intent is durable at this point. A test process can now be
  // terminated without any later mutation having started.
  await options.afterEffect?.('reservation');

  // Each transition is CAS under the short Project Home control lock.
  // The Git command itself does not hold that lock. A durable git-initiated
  // stage fences concurrent retries until explicit quiescence reconciliation.
  for (let count = 0; count < 12; count++) {
    switch (record.stage) {
      case 'completed': {
        // Retrying a completed create must remain idempotent after legitimate
        // human edits: verify canonical identity, not the original scaffold bytes.
        await verifyResult(engine, record);
        return resultOf(record);
      }
      case 'recovery-required': {
        throw recovery('Operation needs explicit repair; inspect the durable journal.');
      }
      case 'git-initiated': {
        if (!options.confirmInterruptedGitSettled) {
          throw recovery('Git effect may still be running; confirm process quiescence before retry.');
        }
        const state = await inspectPlannedGitEffect(engine, record);
        if (state === 'present') {
          record = await transition(engine, record, 'git-provisioned');
        } else if (state === 'absent') {
          record = await transition(engine, record, 'reserved');
        } else {
          throw recovery('Git branch/worktree does not match the intent; manual recovery required.');
        }
        continue;
      }

      case 'reserved': {
        if (record.target.kind === 'new-worktree') {
          await validateNewGitReservation(engine, record);
          record = await transition(engine, record, 'git-initiated');
          // mkdir on the bounded, project-owned sibling directory only.
          // Existing unexpected directories and symlinks fail in revalidation.
          const worktreesParent = dirname(record.target.workspaceRoot);
          await mkdir(worktreesParent, { recursive: true });
          const parentStat = await lstat(worktreesParent);
          if (
            !parentStat.isDirectory() ||
            parentStat.isSymbolicLink() ||
            (await realpath(worktreesParent)) !== worktreesParent
          ) {
            throw recovery('Managed worktree parent was redirected before the Git mutation.');
          }
          const state = await inspectPlannedGitEffect(engine, record);
          if (state !== 'absent') {
            throw recovery('Git state changed between reservation and execution.');
          }
          const completed = await executeGitMutation(engine.context.project.homeRoot, [
            'worktree',
            'add',
            '-b',
            record.target.branch!,
            record.target.workspaceRoot,
            record.target.baseCommit!,
          ]);
          if (completed.exitCode !== 0) {
            throw recovery('Git worktree creation had an uncertain effect; reconcile before retry.');
          }
          await options.afterEffect?.('git');
          if ((await inspectPlannedGitEffect(engine, record)) !== 'present') {
            throw recovery('Created Git worktree does not match the recorded intent.');
          }
          record = await transition(engine, record, 'git-provisioned');
        } else {
          record = await transition(engine, record, 'git-provisioned');
        }
        continue;
      }

      case 'git-provisioned': {
        if (record.target.kind === 'new-worktree') {
          if ((await inspectPlannedGitEffect(engine, record)) !== 'present') {
            throw recovery('Managed Git worktree changed before identity provisioning.');
          }
          record = await ensureLinkedIdentity(engine, record);
        } else {
          await requireRegisteredTarget(engine, record);
        }
        record = await transition(engine, record, 'manifest-writing');
        continue;
      }

      case 'manifest-writing': {
        await requireTargetIdentity(engine, record);
        await writeScaffoldWithEvidence(record);
        await options.afterEffect?.('manifest');
        record = await transition(engine, record, 'manifest-written');
        continue;
      }

      case 'manifest-written': {
        await verifyScaffold(record);
        record = await transition(engine, record, 'registry-writing');
        continue;
      }

      case 'registry-writing': {
        await requireTargetIdentity(engine, record);
        await verifyScaffold(record);
        await commitBinding(engine, record);
        await options.afterEffect?.('registry');
        record = await transition(engine, record, 'registry-linked');
        continue;
      }

      case 'registry-linked': {
        await verifyResult(engine, record);
        record = await transition(engine, record, 'completed');
        continue;
      }
      default: {
        const exhaustive: never = record.stage;
        return exhaustive;
      }
    }
  }
  throw recovery('Create operation exceeded its bounded state transition count.');
}

function normalize(input: CreateSpecificationInput): Omit<CreateSpecificationInput, 'operationId'> {
  const title = input.title.replace(/\s+/gu, ' ').trim();
  const goal = input.goal?.trim();
  // Reuse canonical validation without generating a throwaway Spec identity.
  validateSpecificationScaffoldInput({ title, created: input.created });
  if (input.target.kind === 'existing') {
    if (!isValidSpecificationId(input.target.workspaceId)) {
      throw new CreateOperationError('CREATE_OPERATION_INVALID', 'Invalid target workspaceId.');
    }
    return {
      title,
      created: input.created,
      ...(goal ? { goal } : {}),
      target: { kind: 'existing', workspaceId: input.target.workspaceId },
    };
  }
  if (typeof input.target.baseRef !== 'string' || !input.target.baseRef) {
    throw new CreateOperationError('CREATE_OPERATION_INVALID', 'Git baseRef is required.');
  }
  return {
    title,
    created: input.created,
    ...(goal ? { goal } : {}),
    target: {
      kind: 'new-worktree',
      baseRef: input.target.baseRef,
      ...(input.target.branch ? { branch: input.target.branch } : {}),
    },
  };
}

async function reserve(
  engine: SpecFlowEngine,
  input: Omit<CreateSpecificationInput, 'operationId'>,
  operationId: string,
  fingerprint: string,
): Promise<CreateJournal> {
  return withCreateJournalLock(engine.context, async () => {
    const operations = await listCreateJournals(engine.context);
    const previous = operations.find((item) => item.operationId === operationId);
    if (previous) {
      if (previous.inputFingerprint !== fingerprint) {
        throw new CreateOperationError(
          'CREATE_CONFLICT',
          'OperationId was already used with different immutable inputs.',
        );
      }
      return previous;
    }

    const canonical = await discoverSpecifications(engine);
    // Explicit fail-closed policy: current registry binds specId to workspaceId,
    // but does not persist the authoritative slug of every bound specification.
    // If one source is unavailable, global slug uniqueness cannot be proven.
    // Do not weaken this gate until slug ownership is durably indexed.
    if (canonical.some((item) => item.status !== 'available')) {
      throw recovery('Cannot reserve new Spec while an existing canonical source is unavailable.');
    }
    const specId = randomUUID();
    const scaffold = createSpecificationScaffold({
      specId,
      title: input.title,
      created: input.created,
      goal: input.goal,
    });
    if (
      canonical.some(
        (item) => item.status === 'available' && item.specification.slug === scaffold.slug,
      ) ||
      operations.some((item) => item.slug === scaffold.slug)
    ) {
      throw new CreateOperationError('CREATE_CONFLICT', 'Specification slug is already reserved.');
    }

    let target: CreateJournal['target'];
    if (input.target.kind === 'existing') {
      const registry = await engine.readRegistry();
      const inspected = await inspectRegisteredWorkspace(
        engine.context,
        registry,
        input.target.workspaceId,
      );
      if (inspected.status !== 'available') {
        throw recovery('Selected existing workspace is unavailable.');
      }
      target = {
        kind: 'existing',
        workspaceId: input.target.workspaceId,
        workspaceRoot: inspected.root,
      };
    } else {
      const plan = await openGitCapability(engine).planNewWorktree({
        specId,
        slug: scaffold.slug,
        baseRef: input.target.baseRef,
        branch: input.target.branch,
      });
      if (
        operations.some(
          (item) =>
            item.target.kind === 'new-worktree' &&
            (branchesOverlap(item.target.branch!, plan.branch) ||
              item.target.workspaceRoot.toLowerCase() === plan.targetPath.toLowerCase()),
        )
      ) {
        throw new CreateOperationError(
          'CREATE_CONFLICT',
          'Git branch or worktree path is reserved.',
        );
      }
      target = {
        kind: 'new-worktree',
        workspaceId: randomUUID(),
        workspaceRoot: plan.targetPath,
        instanceId: randomUUID(),
        branch: plan.branch,
        baseCommit: plan.baseCommit,
      };
    }

    const record: CreateJournal = {
      version: 1,
      projectId: engine.context.project.projectId,
      operationId,
      inputFingerprint: fingerprint,
      specId,
      slug: scaffold.slug,
      title: input.title,
      created: input.created,
      ...(input.goal ? { goal: input.goal } : {}),
      stage: 'reserved',
      target,
      files: scaffold.files.map(({ relativePath, sha256 }) => ({ relativePath, sha256 })),
    };
    await publishCreateJournal(engine.context, record);
    return record;
  });
}

async function transition(
  engine: SpecFlowEngine,
  record: CreateJournal,
  stage: CreateStage,
  target = record.target,
): Promise<CreateJournal> {
  return withCreateJournalLock(engine.context, async () => {
    const current = await readCreateJournal(engine.context, record.operationId);
    if (!current || JSON.stringify(current) !== JSON.stringify(record)) {
      throw new CreateOperationError(
        'CREATE_CONFLICT',
        'Create journal changed concurrently; restart from the latest durable state.',
      );
    }
    const next: CreateJournal = { ...current, target, stage };
    await publishCreateJournal(engine.context, next);
    return next;
  });
}

async function verifyResult(engine: SpecFlowEngine, record: CreateJournal): Promise<void> {
  await requireTargetIdentity(engine, record);
  if (record.stage === 'completed') {
    // Once creation is terminal, subsequent Spec Writer changes are legitimate.
    // The immutable scaffold hash only fences unfinished creation stages.
    const current = await readWorkspaceSpecification(record.target.workspaceRoot, record.specId);
    if (current.slug !== record.slug) throw recovery('Completed Spec identity changed.');
  } else {
    await verifyScaffold(record);
  }
  const registry = await engine.readRegistry();
  if (
    !registry.specBindings.some(
      (item) => item.specId === record.specId && item.workspaceId === record.target.workspaceId,
    )
  ) {
    throw recovery('Registry does not contain the expected canonical specification binding.');
  }
}

function resultOf(record: CreateJournal): CreatedSpecification {
  return {
    operationId: record.operationId,
    specId: record.specId,
    slug: record.slug,
    workspaceId: record.target.workspaceId,
    workspaceRoot: record.target.workspaceRoot,
    relativeManifestPath: record.files[0]!.relativePath,
  };
}

function branchesOverlap(left: string, right: string): boolean {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  return a === b || a.startsWith(b + '/') || b.startsWith(a + '/');
}

function recovery(message: string): CreateOperationError {
  return new CreateOperationError('CREATE_RECOVERY_REQUIRED', message);
}
