import { randomUUID } from 'node:crypto';

import type { SpecFlowEngine } from '../../application';
import { executeGit } from '../../git/process';
import { inspectRegisteredWorkspace } from '../../project/workspace-registry';
import { readProjectGitPolicy } from '../../version-control/worktrees/config';
import { resolveSpecification } from '../discovery';
import { isValidSpecificationId } from '../model';
import {
  CloseOperationError,
  fingerprintCloseIntent,
  type ClosePlan,
  type CloseWorkspaceEvidence,
} from './model';
import { sortedResources } from './resources';

export type CloseRequest =
  | { readonly kind: 'worktree-close'; readonly operationId?: string; readonly specId: string }
  | {
      readonly kind: 'specification-close';
      readonly operationId?: string;
      readonly specId: string;
      readonly integrateToTargetBranch?: boolean;
    };

function invalid(message: string): CloseOperationError {
  return new CloseOperationError('CLOSE_PREFLIGHT', message);
}

async function gitValue(root: string, args: readonly string[], reason: string): Promise<string> {
  const value = await executeGit(root, args);
  const result = value.stdout.trim();
  if (value.exitCode !== 0 || !result) throw invalid(reason);
  return result;
}

/** Read-only: git status may refresh index by default; disable optional locks. */
async function gitFacts(workspace: {
  readonly workspaceId: string;
  readonly root: string;
  readonly instanceId?: string;
}): Promise<CloseWorkspaceEvidence> {
  const root = workspace.root;
  const state = await executeGit(root, [
    '-c',
    'core.optionalLocks=false',
    'status',
    '--porcelain=v1',
    '-z',
    '--untracked-files=all',
  ]);
  if (state.exitCode !== 0 || state.stdout) {
    throw invalid(
      'Checkout has staged, modified or untracked files, or Git status is unavailable.',
    );
  }
  const branchRef = await gitValue(
    root,
    ['symbolic-ref', '--quiet', 'HEAD'],
    'Checkout must be on an attached local branch.',
  );
  if (!branchRef.startsWith('refs/heads/')) throw invalid('Checkout branch is not a local ref.');
  const head = await gitValue(
    root,
    ['rev-parse', '--verify', 'HEAD'],
    'Checkout HEAD is unavailable.',
  );
  if (!/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/iu.test(head)) throw invalid('Invalid Git HEAD.');
  return {
    workspaceId: workspace.workspaceId,
    root,
    branch: branchRef.slice('refs/heads/'.length),
    head,
    ...(workspace.instanceId ? { instanceId: workspace.instanceId } : {}),
  };
}

/**
 * Pure read admission: no Git mutation, registry changes, inferred default
 * destination, generated archive commits or workflow/worker fake evidence.
 */
export async function previewCloseOperation(
  engine: SpecFlowEngine,
  request: CloseRequest,
): Promise<ClosePlan> {
  const operationId = request.operationId ?? randomUUID();
  if (request.kind !== 'worktree-close' && request.kind !== 'specification-close') {
    throw new CloseOperationError('CLOSE_INVALID', 'Unknown lifecycle operation kind.');
  }
  if (!isValidSpecificationId(request.specId)) {
    throw new CloseOperationError('CLOSE_INVALID', 'Invalid Specification identity.');
  }
  const canonical = await resolveSpecification(engine, request.specId);
  if (canonical.status !== 'available') {
    throw new CloseOperationError(
      'CLOSE_UNAVAILABLE',
      'Canonical Specification source is unavailable.',
    );
  }
  const registry = await engine.readRegistry();
  const sourceWorkspace = registry.workspaces.find(
    (item) => item.workspaceId === canonical.workspaceId,
  );
  if (!sourceWorkspace) throw invalid('Canonical workspace registration disappeared.');
  const linked = sourceWorkspace.kind === 'linked';
  if (linked && !sourceWorkspace.managed)
    throw invalid('Unmanaged linked worktree cannot be closed.');
  if (linked) {
    const occupants = registry.specBindings.filter(
      (item) => item.workspaceId === sourceWorkspace.workspaceId,
    );
    if (occupants.length !== 1 || occupants[0]?.specId !== request.specId) {
      throw invalid('Linked worktree is not exclusively bound to this Specification.');
    }
  }
  if (request.kind === 'worktree-close' && !linked) {
    throw invalid('Close Worktree requires a managed linked checkout.');
  }
  if (request.kind === 'specification-close') {
    if (canonical.specification.location !== 'active') {
      throw invalid('Only an active Specification can be archived.');
    }
    if (
      request.integrateToTargetBranch !== undefined &&
      typeof request.integrateToTargetBranch !== 'boolean'
    ) {
      throw new CloseOperationError('CLOSE_INVALID', 'Invalid integration selection.');
    }
    if (!linked && request.integrateToTargetBranch !== undefined) {
      throw new CloseOperationError(
        'CLOSE_INVALID',
        'Integration selection is not applicable in primary.',
      );
    }
  }
  const source = await gitFacts(sourceWorkspace);
  const integrate =
    request.kind === 'worktree-close' ||
    (request.kind === 'specification-close' && linked && (request.integrateToTargetBranch ?? true));
  const needsTarget = integrate || !linked;
  let target: CloseWorkspaceEvidence | undefined;
  let targetBranch: string | undefined;
  let configRevision: string | undefined;
  if (needsTarget) {
    const configured = await readProjectGitPolicy(engine.context);
    targetBranch = configured.policy.integrationTargetBranch;
    if (!targetBranch) {
      throw invalid(
        'Project Home requires explicit git.integrationTargetBranch configuration before this operation.',
      );
    }
    configRevision = configured.revision;
    const primary = registry.workspaces.find(
      (item) => item.workspaceId === registry.primaryWorkspaceId,
    );
    if (primary?.kind !== 'primary')
      throw invalid('Verified primary workspace is unavailable.');
    const inspected = await inspectRegisteredWorkspace(
      engine.context,
      registry,
      primary.workspaceId,
    );
    if (inspected.status !== 'available') throw invalid('Primary worktree is unavailable.');
    target = source.workspaceId === primary.workspaceId ? source : await gitFacts(primary);
    if (target.branch !== targetBranch) {
      throw invalid(
        'Primary worktree is checked out on a different branch from git.integrationTargetBranch.',
      );
    }
  }
  const binding = registry.specBindings.find((item) => item.specId === request.specId);
  const normalized =
    request.kind === 'worktree-close'
      ? { kind: 'worktree-close' as const, operationId, specId: request.specId }
      : {
          kind: 'specification-close' as const,
          operationId,
          specId: request.specId,
          integrateToTargetBranch: linked ? (request.integrateToTargetBranch ?? true) : false,
        };

  const resources = sortedResources([
    'spec:' + request.specId,
    'checkout:' + source.workspaceId,
    'ref:refs/heads/' + source.branch.toLowerCase(),
    ...(target && target.workspaceId !== source.workspaceId
      ? ['checkout:' + target.workspaceId, 'ref:refs/heads/' + target.branch.toLowerCase()]
      : []),
    ...(linked && integrate ? ['git-worktree-admin:' + engine.context.project.projectId] : []),
  ]);
  // A revision is only a snapshot: journal reservation MUST revalidate it
  // while holding the existing Project Home short lock.
  return {
    kind: request.kind,
    operationId,
    specId: request.specId,
    fingerprint: fingerprintCloseIntent(normalized),
    slug: canonical.specification.slug,
    location: canonical.specification.location,
    registryRevision: registry.revision,
    ...(binding ? { bindingGeneration: binding.generation } : {}),
    source,
    ...(target ? { target } : {}),
    ...(targetBranch ? { targetBranch } : {}),
    ...(request.kind === 'specification-close' && linked
      ? { integrateToTargetBranch: integrate }
      : {}),
    ...(configRevision ? { configRevision } : {}),
    resources,
  };
}
