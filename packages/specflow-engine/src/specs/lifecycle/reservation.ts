import { isDeepStrictEqual } from 'node:util';

import type { SpecFlowEngine } from '../../application';
import { withProjectControlLock } from '../../project/control-lock';
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
  return withProjectControlLock(engine.context, async () => {
    const previous = await readCloseJournal(engine.context, request.operationId);
    if (previous) {
      // Include effective linked default in the identity; an identical retry
      // only observes its own journal and never replays mutation.
      if (previous.plan.kind !== request.kind || previous.plan.specId !== request.specId) {
        throw new CloseOperationError('CLOSE_CONFLICT', 'OperationId belongs to a different lifecycle intent.');
      }
      if (request.kind === 'specification-close' && request.integrateToTargetBranch !== undefined) {
        const integrated = previous.plan.target !== undefined &&
          previous.plan.source.workspaceId !== previous.plan.target.workspaceId;
        if (integrated !== request.integrateToTargetBranch) {
          throw new CloseOperationError('CLOSE_CONFLICT', 'OperationId changed immutable integration selection.');
        }
      }
      return { journal: previous, existing: true };
    }
    const plan: ClosePlan = await previewCloseOperation(engine, request);
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
