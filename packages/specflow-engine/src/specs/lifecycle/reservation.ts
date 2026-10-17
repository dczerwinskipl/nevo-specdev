import { isDeepStrictEqual } from 'node:util';

import type { SpecFlowEngine } from '../../application';
import { withProjectControlLock } from '../../project/control-lock';
import { readWorkspaceRegistry } from '../../project/workspace-registry';
import { readProjectGitPolicy } from '../../version-control/worktrees/config';
import { CloseOperationError, type CloseJournal, type ClosePlan } from './model';
import { readCloseJournal, publishCloseJournal } from './journal-store';
import { assertResourcesAvailable } from './resources';
import { previewCloseOperation, type CloseRequest } from './preflight';

export async function inspectCloseOperation(
  engine: SpecFlowEngine,
  operationId: string,
): Promise<CloseJournal | undefined> {
  await engine.readRegistry();
  return readCloseJournal(engine.context, operationId);
}

/**
 * Durable admission ONLY. No archive, merge, registry rebind or worktree
 * disposal side effect exists in T10. Future use cases must own transitions.
 * Journal itself is the atomic resource reservation record, not an extra
 * registry file that could be torn by SIGKILL between two publications.
 */
export async function reserveCloseOperation(
  engine: SpecFlowEngine,
  request: CloseRequest & { readonly operationId: string },
): Promise<{ readonly journal: CloseJournal; readonly existing: boolean }> {
  // An existing reservation must remain observable even after Git/archive
  // mutations make the original first-admission preview impossible.
  const existing = await readCloseJournal(engine.context, request.operationId);
  if (existing) {
    assertMatchingRequest(existing, request);
    return { journal: existing, existing: true };
  }
  // Git inspection is outside the short coordination lock. The immutable
  // snapshot is verified against registry/config CAS inside the lock, and
  // future effects must re-verify pinned HEAD/index/physical source.
  const plan: ClosePlan = await previewCloseOperation(engine, request);
  return withProjectControlLock(engine.context, async () => {
    const previous = await readCloseJournal(engine.context, request.operationId);
    if (previous) {
      assertMatchingRequest(previous, request);
      return { journal: previous, existing: true };
    }
    const latest = await readWorkspaceRegistry(engine.context);
    if (latest.revision !== plan.registryRevision) {
      throw new CloseOperationError('CLOSE_CONFLICT', 'Registry revision changed after preview.');
    }
    if (plan.configRevision !== undefined) {
      const config = await readProjectGitPolicy(engine.context);
      if (config.revision !== plan.configRevision ||
          config.policy.integrationTargetBranch !== plan.targetBranch) {
        throw new CloseOperationError('CLOSE_CONFLICT', 'Project integration policy changed after preview.');
      }
    }
    await assertResourcesAvailable(engine.context, plan.resources, {
      kind: 'close',
      operationId: plan.operationId,
    });
    const journal: CloseJournal = {
      version: 1,
      projectId: engine.context.project.projectId,
      gitInstanceId: engine.context.project.gitInstanceId,
      stage: 'reserved',
      plan,
    };
    await publishCloseJournal(engine.context, journal);
    const stored = await readCloseJournal(engine.context, plan.operationId);
    if (!stored || !isDeepStrictEqual(stored, journal)) {
      throw new CloseOperationError('CLOSE_RECOVERY_REQUIRED', 'Close reservation was not durably verified.');
    }
    return { journal: stored, existing: false };
  });
}

function assertMatchingRequest(
  journal: CloseJournal,
  request: CloseRequest & { readonly operationId: string },
): void {
  if (journal.plan.kind !== request.kind || journal.plan.specId !== request.specId) {
    throw new CloseOperationError('CLOSE_CONFLICT', 'OperationId belongs to another lifecycle intent.');
  }
  if (request.kind === 'specification-close' &&
      request.integrateToTargetBranch !== undefined &&
      journal.plan.integrateToTargetBranch !== request.integrateToTargetBranch) {
    throw new CloseOperationError('CLOSE_CONFLICT', 'OperationId changed immutable integration selection.');
  }
}
