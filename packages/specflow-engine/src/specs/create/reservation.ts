import { randomUUID } from 'node:crypto';

import type { SpecFlowEngine } from '../../application';
import { inspectRegisteredWorkspace } from '../../project/workspace-registry';
import { openVersionControl } from '../../version-control';
import { fingerprintCreateClientIntent, type CreateClientIntent } from '../create-intent';
import {
  CreateOperationError,
  listCreateJournals,
  publishCreateJournal,
  withCreateJournalLock,
  type CreateJournal,
  type CreateJournalV2,
} from '../create-journal';
import { sha256 } from '../create-scaffold';
import { discoverSpecifications } from '../discovery';
import {
  createSpecificationScaffold,
  isValidSpecificationId,
  validateSpecificationScaffoldInput,
} from '../model';
import type { CreateSpecificationInput } from '../durable-create';

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

function legacyFingerprint(intent: CreateClientIntent, created: string): string {
  // The exact original v1 normalized field order and HEAD fallback.
  const legacy: CreateSpecificationInput = {
    operationId: '00000000-0000-4000-8000-000000000000',
    title: intent.title,
    created,
    ...(intent.goal ? { goal: intent.goal } : {}),
    target:
      intent.target.kind === 'existing'
        ? intent.target
        : {
            kind: 'new-worktree',
            baseRef:
              intent.target.baseRef.kind === 'explicit' ? intent.target.baseRef.value : 'HEAD',
            ...(intent.target.branch.kind === 'explicit'
              ? { branch: intent.target.branch.value }
              : {}),
          },
  };
  return sha256(JSON.stringify(normalize(legacy)));
}

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
  return withCreateJournalLock(engine.context, async () => {
    const operations = await listCreateJournals(engine.context);
    const previous = operations.find((item) => item.operationId === operationId);
    if (previous) {
      const fingerprint =
        previous.version === 1
          ? legacyFingerprint(intent, previous.created)
          : fingerprintCreateClientIntent(intent);
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

    let target: CreateJournalV2['target'];
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
    await publishCreateJournal(engine.context, record);
    return { record, existing: false };
  });
}

function branchesOverlap(left: string, right: string): boolean {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  return a === b || a.startsWith(b + '/') || b.startsWith(a + '/');
}

function recovery(message: string): CreateOperationError {
  return new CreateOperationError('CREATE_RECOVERY_REQUIRED', message);
}
