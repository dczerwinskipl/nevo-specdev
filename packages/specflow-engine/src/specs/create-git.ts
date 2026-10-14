import { lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { SpecFlowEngine } from '../application';
import { openGitCapability } from '../git/capability';
import { executeGit } from '../git/process';
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

/** Git worktree provisioning, reconciliation and physical checkout identity. */
export async function validateNewGitReservation(
  engine: SpecFlowEngine,
  record: CreateJournal,
): Promise<void> {
  const plan = await openGitCapability(engine).planNewWorktree({
    specId: record.specId,
    slug: record.slug,
    baseRef: record.target.baseCommit!,
    branch: record.target.branch,
    targetPath: record.target.workspaceRoot,
  });
  if (
    plan.baseCommit !== record.target.baseCommit ||
    plan.targetPath !== record.target.workspaceRoot
  ) {
    throw recovery('Planned Git repository or base identity has changed.');
  }
}

export async function inspectPlannedGitEffect(
  engine: SpecFlowEngine,
  record: CreateJournal,
): Promise<'absent' | 'present' | 'conflict'> {
  const git = openGitCapability(engine);
  const items = await git.listWorktrees();
  const target = record.target;
  const present = items.find(
    (item) => item.root.toLowerCase() === target.workspaceRoot.toLowerCase(),
  );
  if (present) {
    return !present.prunable &&
      present.branch === 'refs/heads/' + target.branch &&
      present.head === target.baseCommit
      ? 'present'
      : 'conflict';
  }
  const branchExists = items.some((item) => item.branch === 'refs/heads/' + target.branch);
  if (branchExists) return 'conflict';
  // Git can create a ref and then fail before publishing worktree metadata.
  // A detached ref is NOT proof that the planned effect is absent.
  const refs = await executeGit(engine.context.project.homeRoot, [
    'for-each-ref',
    '--format=%(refname)',
    'refs/heads',
  ]);
  if (refs.exitCode !== 0) return 'conflict';
  const plannedRef = ('refs/heads/' + target.branch).toLowerCase();
  if (
    refs.stdout.split('\n').some((value) => {
      const ref = value.toLowerCase();
      return (
        ref === plannedRef || ref.startsWith(plannedRef + '/') || plannedRef.startsWith(ref + '/')
      );
    })
  )
    return 'conflict';
  const stat = await lstat(target.workspaceRoot).catch((error: unknown) => {
    if (isMissing(error)) return undefined;
    throw error;
  });
  if (stat !== undefined) return 'conflict';
  return 'absent';
}

export async function ensureLinkedIdentity(
  engine: SpecFlowEngine,
  record: CreateJournal,
): Promise<CreateJournal> {
  if (!record.target.instanceId) {
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

export async function requireTargetIdentity(engine: SpecFlowEngine, record: CreateJournal): Promise<void> {
  if (record.target.kind === 'existing') {
    await requireRegisteredTarget(engine, record);
  } else {
    if (record.stage === 'completed') {
      // After successful create, legitimate agents may advance HEAD. Validate
      // membership and the original branch, but not the provisioning commit.
      // Physical checkout incarnation remains verified below.
      const worktrees = await openGitCapability(engine).listWorktrees();
      const matching = worktrees.filter(
        (item) => item.root.toLowerCase() === record.target.workspaceRoot.toLowerCase(),
      );
      if (
        matching.length !== 1 ||
        matching[0]!.prunable ||
        matching[0]!.branch !== 'refs/heads/' + record.target.branch
      ) {
        throw recovery('Completed Git worktree changed its path or branch.');
      }
    } else if ((await inspectPlannedGitEffect(engine, record)) !== 'present') {
      // Before terminal completion, exact base HEAD is still critical evidence
      // that this is the worktree produced by the planned Git mutation.
      throw recovery('Git worktree or branch changed since creation.');
    }
    const registration = registrationOf(record);
    await verifyWorkspaceRoot(engine.context, registration.root, registration);
  }
}

export function registrationOf(record: CreateJournal): WorkspaceRegistration {
  if (!record.target.instanceId)
    throw recovery('Linked worktree has no durable identity evidence.');
  return {
    kind: 'linked',
    managed: true,
    workspaceId: record.target.workspaceId,
    root: record.target.workspaceRoot,
    instanceId: record.target.instanceId,
  };
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
