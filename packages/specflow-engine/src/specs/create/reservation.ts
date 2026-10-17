import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

import type { SpecFlowEngine } from '../../application';
import { assertResourcesAvailable, resourcesForCreate } from '../lifecycle/resources';
import { CloseOperationError } from '../lifecycle/model';
import { inspectRegisteredWorkspace } from '../../project/workspace-registry';
import { openVersionControl } from '../../version-control';
import { fingerprintCreateClientIntent, type CreateClientIntent } from '../create-intent';
import {
  CreateOperationError,
  listCreateJournals,
  publishCreateJournal,
  withCreateJournalLock,
  type CreateJournal,
} from '../create-journal';
import { discoverSpecifications } from '../discovery';
import {
  createSpecificationScaffold,
  isValidSpecificationId,
  validateSpecificationScaffoldInput,
} from '../model';

/**
 * First lock winner owns the creation date and pinned Git effect plan.
 * Previous operationId is checked BEFORE a local clock or config default.
 */
export async function reserveCreateOperation(
  engine: SpecFlowEngine,
  intent: CreateClientIntent,
  operationId: string,
  creationDate: () => string,
): Promise<{ readonly record: CreateJournal; readonly existing: boolean }> {
  // Preserve the existing separate-Spec Create outcome: overlapping writers
  // are serialized, never admitted to mutate the same checkout in parallel.
  // A crash-owned claim is NOT stolen by a timeout.
  const deadline = Date.now() + 25000;
  while (true) {
    try {
      return await withCreateJournalLock(engine.context, async () => {
    const operations = await listCreateJournals(engine.context);
    const previous = operations.find((item) => item.operationId === operationId);
    if (previous) {
      const fingerprint = fingerprintCreateClientIntent(intent);
      if (previous.inputFingerprint !== fingerprint) {
        throw new CreateOperationError(
          'CREATE_CONFLICT',
          'OperationId was already used with different immutable inputs.',
        );
      }
      return { record: previous, existing: true };
    }

    // Date generated once under Project Home lock, after checking no journal.
    const created = creationDate();
    validateSpecificationScaffoldInput({ title: intent.title, created });
    const canonical = await discoverSpecifications(engine);
    if (canonical.some((item) => item.status !== 'available')) {
      throw recovery('Cannot reserve new Spec while an existing canonical source is unavailable.');
    }
    const specId = randomUUID();
    const scaffold = createSpecificationScaffold({
      specId,
      title: intent.title,
      created,
      goal: intent.goal,
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
    let gitPlan: { readonly projectRoot: string; readonly gitInstanceId: string } | undefined;
    if (intent.target.kind === 'existing') {
      if (!isValidSpecificationId(intent.target.workspaceId)) {
        throw new CreateOperationError('CREATE_OPERATION_INVALID', 'Invalid target workspaceId.');
      }
      const registry = await engine.readRegistry();
      const inspected = await inspectRegisteredWorkspace(
        engine.context,
        registry,
        intent.target.workspaceId,
      );
      if (inspected.status !== 'available') {
        throw recovery('Selected existing workspace is unavailable.');
      }
      target = {
        kind: 'existing',
        workspaceId: intent.target.workspaceId,
        workspaceRoot: inspected.root,
      };
    } else {
      const plan = await openVersionControl(engine).worktrees.plan({
        slug: scaffold.slug,
        shortId: specId.slice(0, 8),
        ...(intent.target.baseRef.kind === 'explicit'
          ? { baseRefOverride: intent.target.baseRef.value }
          : {}),
        ...(intent.target.branch.kind === 'explicit'
          ? { branchOverride: intent.target.branch.value }
          : {}),
      });
      if (
        operations.some(
          (item) =>
            item.target.kind === 'new-worktree' &&
            (branchesOverlap(item.target.branch, plan.branch) ||
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
      gitPlan = {
        projectRoot: plan.projectRoot,
        gitInstanceId: plan.gitInstanceId,
      };
    }

    const record: CreateJournal = {
      version: 2,
      projectId: engine.context.project.projectId,
      operationId,
      inputFingerprint: fingerprintCreateClientIntent(intent),
      requestIntent: intent,
      specId,
      slug: scaffold.slug,
      title: intent.title,
      created,
      ...(intent.goal ? { goal: intent.goal } : {}),
      stage: 'reserved',
      target,
      ...(gitPlan ? { gitPlan } : {}),
      files: scaffold.files.map(({ relativePath, sha256 }) => ({ relativePath, sha256 })),
    };
    await assertResourcesAvailable(engine.context, resourcesForCreate(record));
    await publishCreateJournal(engine.context, record);
    return { record, existing: false };
      });
    } catch (error) {
      if (error instanceof CloseOperationError && error.code === 'CLOSE_CONFLICT') {
        if (Date.now() < deadline) {
          await sleep(50);
          continue;
        }
        throw new CreateOperationError(
          'CREATE_CONFLICT',
          'Checkout/ref is reserved by an unfinished Create or Close operation.',
        );
      }
      throw error;
    }
  }
}

function branchesOverlap(left: string, right: string): boolean {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  return a === b || a.startsWith(b + '/') || b.startsWith(a + '/');
}

function recovery(message: string): CreateOperationError {
  return new CreateOperationError('CREATE_RECOVERY_REQUIRED', message);
}
