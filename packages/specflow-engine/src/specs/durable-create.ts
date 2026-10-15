import { isDeepStrictEqual } from 'node:util';

import type { SpecFlowEngine } from '../application';
import { normalizeCreateClientIntent, type CreateClientIntent } from './create-intent';
import { verifyScaffold, writeScaffoldWithEvidence } from './create-scaffold';
import { reserveCreateOperation } from './create/reservation';
import { followExistingCreateOperation } from './create/observation';
import type { CreateSpecificationInput } from './create/create-input';
export type { CreateSpecificationInput, CreateSpecificationTarget } from './create/create-input';
import { commitBinding } from './create-binding';
import {
  createPlannedGitWorktree,
  ensureLinkedIdentity,
  inspectPlannedGitEffect,
  requireRegisteredTarget,
  requireTargetIdentity,
  validateNewGitReservation,
} from './create-git';

import { readWorkspaceSpecification } from './repository';
import {
  CreateOperationError,
  publishCreateJournal,
  readCreateJournal,
  validateOperationId,
  withCreateJournalLock,
  type CreateJournal,
  type CreateStage,
} from './create-journal';

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
  /**
   * Explicit operator assertion that the original create executor is no
   * longer active. Required to resume a nonterminal v2 journal, including
   * reserved, manifest-writing and registry-writing. This is NOT inferred
   * from elapsed time or from a stale journal stage.
   *
   * The git-initiated stage additionally requires confirmInterruptedGitSettled.
   * Neither recovery assertion is available to CLI/HTTP requests.
   */
  readonly resumeInterruptedOperation?: boolean;
}

/** Internal fault-injection seam, deliberately absent from CreateSpecificationOptions. */
export type CreateEffectHook = (
  effect: 'reservation' | 'git' | 'manifest' | 'registry',
) => Promise<void>;

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
/**
 * Trusted low-level Engine API. Its explicit 'created' is a clock/test input;
 * v2 still chooses it only while holding the first reservation lock.
 */
export async function createSpecification(
  engine: SpecFlowEngine,
  input: CreateSpecificationInput,
  options: CreateSpecificationOptions = {},
): Promise<CreatedSpecification> {
  return createSpecificationWithIntent(
    engine,
    input.operationId,
    normalizeCreateClientIntent(input),
    () => input.created,
    options,
  );
}

/**
 * One version-aware reservation path for both transports and direct Engine.
 * No new journal v1 can be minted. Existing v1 is retained verbatim on retry.
 */
export async function createSpecificationWithIntent(
  engine: SpecFlowEngine,
  operationId: string,
  intent: CreateClientIntent,
  creationDate: () => string,
  options: CreateSpecificationOptions = {},
  afterEffect?: CreateEffectHook,
): Promise<CreatedSpecification> {
  validateOperationId(operationId);
  const reservation = await reserveCreateOperation(engine, intent, operationId, creationDate);
  let record = reservation.record;
  // The journal intent is durable at this point. A test process can now be
  // terminated without any later mutation having started.
  await afterEffect?.('reservation');

  // A normal retry of an already-reserved v2 operation is *only* a reader.
  // Its original writer may still be active inside an uncertain Git/FS stage,
  // even if the journal has not changed for a long time. Do not infer a lease
  // or quiescence from the persisted stage, and do not execute any side effect.
  // Only resumeInterruptedOperation permits takeover of Create. The separate
  // confirmInterruptedGitSettled flag cannot bypass this writer boundary.
  if (
    reservation.existing &&
    record.version === 2 &&
    record.stage !== 'completed' &&
    !options.resumeInterruptedOperation
  ) {
    const observed = await followExistingCreateOperation(engine, operationId);
    if (observed.stage !== 'completed') {
      throw recovery(
        'Create is still active or interrupted; operator-confirmed recovery is required.',
      );
    }
    await verifyResult(engine, observed);
    return resultOf(observed);
  }

  // All subsequent transitions are CAS under the short Project Home lock.
  // No Git or filesystem effects run while holding that lock. The original
  // git-initiated quiescence gate applies unchanged to manual recovery.
  try {
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
            throw recovery(
              'Git effect may still be running; confirm process quiescence before retry.',
            );
          }
          const state = await inspectPlannedGitEffect(engine, record);
          if (state === 'present') {
            record = await transition(engine, record, 'git-provisioned');
          } else if (state === 'absent') {
            record = await transition(engine, record, 'reserved');
          } else {
            throw recovery(
              'Git branch/worktree does not match the intent; manual recovery required.',
            );
          }
          continue;
        }

        case 'reserved': {
          if (record.target.kind === 'new-worktree') {
            await validateNewGitReservation(engine, record);
            record = await transition(engine, record, 'git-initiated');
            // WorktreePort owns every filesystem/Git side effect. The durable
            // git-initiated transition was committed above, before this call.
            await createPlannedGitWorktree(engine, record);
            await afterEffect?.('git');
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
          await afterEffect?.('manifest');
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
          await afterEffect?.('registry');
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
  } catch (error) {
    if (
      record.version === 2 &&
      error instanceof CreateOperationError &&
      error.code === 'CREATE_CONFLICT'
    ) {
      // An advanced CAS means another writer won. Do not retry the same
      // effect; observe completion and verify the persisted identity.
      const observed = await followExistingCreateOperation(engine, record.operationId);
      if (observed.stage === 'completed') {
        await verifyResult(engine, observed);
        return resultOf(observed);
      }
      throw recovery('Concurrent create did not reach completion; inspect the journal.');
    }
    throw error;
  }
}

async function transition(
  engine: SpecFlowEngine,
  record: CreateJournal,
  stage: CreateStage,
): Promise<CreateJournal> {
  return withCreateJournalLock(engine.context, async () => {
    const current = await readCreateJournal(engine.context, record.operationId);
    if (!current || !isDeepStrictEqual(current, record)) {
      throw new CreateOperationError(
        'CREATE_CONFLICT',
        'Create journal changed concurrently; restart from the latest durable state.',
      );
    }
    const next: CreateJournal = { ...current, stage };
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

function recovery(message: string): CreateOperationError {
  return new CreateOperationError('CREATE_RECOVERY_REQUIRED', message);
}
