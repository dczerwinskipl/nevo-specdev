import { lstat, readFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

import type { SpecFlowEngine } from '../application';
import { GitCapabilityError } from '../git/errors';
import { openVersionControl } from '../version-control';
import type { WorktreePlan, WorktreeEffect } from '../version-control/worktrees/port';
import {
  inspectRegisteredWorkspace,
  verifyWorkspaceRoot,
  type WorkspaceRegistration,
} from '../project/workspace-registry';
import {
  WORKSPACE_IDENTITY_RELATIVE_PATH,
  provisionLinkedWorkspaceIdentity,
  verifyLinkedWorkspaceIdentity,
} from '../project/workspace-identity';
import { CreateOperationError, type CreateJournal } from './create-journal';
import { registrationOf } from './create/registration';

/**
 * Reconstruct a fixed plan from durable evidence, never from the latest naming
 * policy. V1 predates a stored gitInstanceId; Project Home's independently
 * persisted sentinel/registry remains its authority (validated on port reads).
 */
export function planFromCreateJournal(engine: SpecFlowEngine, record: CreateJournal): WorktreePlan {
  const target = record.target;
  if (
    target.kind !== 'new-worktree' ||
    !target.branch ||
    !target.baseCommit ||
    (record.version === 2 &&
      (record.gitPlan?.projectRoot !== engine.context.project.homeRoot ||
        record.gitPlan?.gitInstanceId !== engine.context.project.gitInstanceId))
  ) {
    throw recovery('Create journal has no valid pinned Git worktree plan.');
  }
  // V1 did not persist a separate Git plan: its original target identity is
  // derived from the reserved slug and the immutable Project Home location.
  // A different direct child under the same managed parent is NOT equivalent.
  const home = engine.context.project.homeRoot;
  const expectedTarget = join(dirname(home), basename(home) + '-worktrees', record.slug);
  const actualTarget = target.workspaceRoot;
  const matchesTarget =
    process.platform === 'win32'
      ? actualTarget.toLowerCase() === expectedTarget.toLowerCase()
      : actualTarget === expectedTarget;
  if (resolve(actualTarget) !== actualTarget || !matchesTarget) {
    throw recovery('Journal worktree target does not match the originally reserved slug.');
  }
  return {
    projectId: record.projectId,
    gitInstanceId: engine.context.project.gitInstanceId,
    projectRoot: home,
    targetPath: actualTarget,
    branch: target.branch,
    baseCommit: target.baseCommit,
  };
}

/**
 * For a reserved operation, policy fences NEW mutations, but is not consulted
 * for effects inspection or post-Git recovery. Do not re-resolve baseRef.
 */
export async function validateNewGitReservation(
  engine: SpecFlowEngine,
  record: CreateJournal,
): Promise<void> {
  const worktrees = openVersionControl(engine).worktrees;
  const availability = await worktrees.availability();
  if (availability.status === 'disabled') {
    throw new GitCapabilityError('GIT_DISABLED', 'Managed worktree creation is disabled.');
  }
  if (availability.status === 'unavailable') {
    throw new GitCapabilityError('GIT_UNAVAILABLE', 'Git worktree automation is unavailable.');
  }
  await worktrees.validateReservedPlan(planFromCreateJournal(engine, record));
  // A newly reserved plan must have no evidence of a previous effect.
  // An interrupted git-initiated stage takes a separate explicit recovery route.
  if ((await worktrees.inspectEffect(planFromCreateJournal(engine, record))) !== 'absent') {
    throw recovery('Git branch or worktree differs from the reserved intent.');
  }
}

export async function inspectPlannedGitEffect(
  engine: SpecFlowEngine,
  record: CreateJournal,
): Promise<WorktreeEffect> {
  return openVersionControl(engine).worktrees.inspectEffect(planFromCreateJournal(engine, record));
}

export async function createPlannedGitWorktree(
  engine: SpecFlowEngine,
  record: CreateJournal,
): Promise<void> {
  // The caller is Durable Create only, after its persisted git-initiated stage.
  // This module does not publish or modify journal/registry state.
  await openVersionControl(engine).worktrees.create(planFromCreateJournal(engine, record));
}

export async function ensureLinkedIdentity(
  engine: SpecFlowEngine,
  record: CreateJournal,
): Promise<CreateJournal> {
  if (record.target.kind !== 'new-worktree' || !record.target.instanceId) {
    throw recovery('Managed checkout has no reserved physical identity.');
  }
  const path = join(record.target.workspaceRoot, WORKSPACE_IDENTITY_RELATIVE_PATH);
  let registration: WorkspaceRegistration;
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink()) throw recovery('Identity marker redirected.');
    const parsed = JSON.parse(await readFile(path, 'utf8')) as unknown;
    if (
      !isRecord(parsed) ||
      parsed.version !== 1 ||
      parsed.projectId !== record.projectId ||
      parsed.workspaceId !== record.target.workspaceId ||
      typeof parsed.instanceId !== 'string' ||
      parsed.instanceId !== record.target.instanceId
    ) {
      throw recovery('Identity marker belongs to a different worktree; manual repair required.');
    }
    registration = {
      kind: 'linked',
      managed: true,
      workspaceId: record.target.workspaceId,
      root: record.target.workspaceRoot,
      instanceId: parsed.instanceId,
    };
  } catch (error) {
    if (!isMissing(error)) {
      if (error instanceof SyntaxError) throw recovery('Identity marker is corrupt.');
      throw error;
    }
    registration = await provisionLinkedWorkspaceIdentity(
      engine.context,
      record.target.workspaceRoot,
      record.target.workspaceId,
      true,
      record.target.instanceId,
    );
  }
  await verifyLinkedWorkspaceIdentity(engine.context, registration);
  return record;
}

export async function requireRegisteredTarget(
  engine: SpecFlowEngine,
  record: CreateJournal,
): Promise<void> {
  const registry = await engine.readRegistry();
  const inspected = await inspectRegisteredWorkspace(
    engine.context,
    registry,
    record.target.workspaceId,
  );
  if (inspected.status !== 'available' || inspected.root !== record.target.workspaceRoot) {
    throw recovery('Existing target checkout moved or became unavailable.');
  }
}

export async function requireTargetIdentity(
  engine: SpecFlowEngine,
  record: CreateJournal,
): Promise<void> {
  if (record.target.kind === 'existing') {
    await requireRegisteredTarget(engine, record);
  } else {
    if (record.stage === 'completed') {
      // After successful create, legitimate agents may advance HEAD. Validate
      // membership and the original branch, but not the provisioning commit.
      // Physical checkout incarnation remains verified below.
      await openVersionControl(engine).worktrees.inspectCreated(
        planFromCreateJournal(engine, record),
      );
    } else if ((await inspectPlannedGitEffect(engine, record)) !== 'present') {
      // Before terminal completion, exact base HEAD is still critical evidence
      // that this is the worktree produced by the planned Git mutation.
      throw recovery('Git worktree or branch changed since creation.');
    }
    const registration = registrationOf(record);
    await verifyWorkspaceRoot(engine.context, registration.root, registration);
  }
}

function recovery(message: string): CreateOperationError {
  return new CreateOperationError('CREATE_RECOVERY_REQUIRED', message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMissing(error: unknown): boolean {
  return isRecord(error) && error.code === 'ENOENT';
}
