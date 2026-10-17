import { lstat, mkdir, realpath } from 'node:fs/promises';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  parse as parsePath,
  relative,
  resolve,
  sep,
} from 'node:path';

import type { SpecFlowEngine } from '../../application';
import { GitCapabilityError } from '../../git/errors';
import { createLocalGitClient, type LocalWorktreeFacts } from '../git/client';
import { loadGitWorktreePolicy } from './config';
import { resolveWorktreeBranch, validateBranchName } from './policy';
import type { WorktreeEffect, WorktreePlan, WorktreePort } from './port';

/**
 * Internal Engine composition. The mutation port is not a public package export.
 * Journal, reservations and explicit recovery never belong to this adapter.
 */
export function createGitWorktreePort(engine: SpecFlowEngine): WorktreePort {
  const home = engine.context.project.homeRoot;
  const git = createLocalGitClient(home);
  const parent = join(dirname(home), basename(home) + '-worktrees');

  const assertRepository = async (): Promise<void> => {
    // Check the Git executable first so capability discovery can report an
    // unavailable client before Project Home verification invokes other Git reads.
    const commonDir = await git.inspectRepository();
    await engine.readRegistry();
    if (commonDir !== engine.context.project.gitCommonDir) {
      throw new GitCapabilityError(
        'WORKTREE_MEMBERSHIP_MISMATCH',
        'Repository identity differs from the designated Project Home.',
      );
    }
  };

  const assertPlanIdentity = (plan: WorktreePlan): void => {
    const project = engine.context.project;
    if (
      plan.projectId !== project.projectId ||
      plan.gitInstanceId !== project.gitInstanceId ||
      plan.projectRoot !== home ||
      !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/iu.test(plan.baseCommit)
    ) {
      throw new GitCapabilityError(
        'WORKTREE_MEMBERSHIP_MISMATCH',
        'Persisted worktree plan belongs to another project or Git instance.',
      );
    }
    const path = plan.targetPath;
    if (
      !isAbsolute(path) ||
      resolve(path) !== path ||
      !sameFilesystemPath(dirname(path), parent) ||
      !basename(path) ||
      basename(path).startsWith('.')
    ) {
      throw new GitCapabilityError('WORKTREE_PATH_CONFLICT', 'Unsafe managed worktree target.');
    }
    validateBranchName(plan.branch);
  };

  const inspect = async (plan: WorktreePlan): Promise<WorktreeEffect> => {
    await assertRepository();
    assertPlanIdentity(plan);
    const worktrees = await git.listWorktrees();
    const matching = worktrees.filter((item) => sameFilesystemPath(item.root, plan.targetPath));
    if (matching.length > 1) return 'conflict';
    const present = matching[0];
    if (present) {
      return !present.prunable &&
        present.branch === 'refs/heads/' + plan.branch &&
        present.head === plan.baseCommit
        ? 'present'
        : 'conflict';
    }
    const refs = await git.listLocalRefs();
    if (refs.some((item) => refsConflict(item, 'refs/heads/' + plan.branch))) return 'conflict';
    if (
      worktrees.some(
        (item) => item.branch?.toLowerCase() === ('refs/heads/' + plan.branch).toLowerCase(),
      )
    )
      return 'conflict';
    const stat = await lstat(plan.targetPath).catch((error: unknown) => {
      if (isMissing(error)) return undefined;
      throw error;
    });
    return stat ? 'conflict' : 'absent';
  };

  const validateReservedPlan = async (plan: WorktreePlan): Promise<void> => {
    await assertRepository();
    assertPlanIdentity(plan);
    await git.validateBranch(plan.branch);
    await git.verifyBaseProjectConfig(plan.baseCommit);
    await assertSafeTargetParents(plan.targetPath);
  };

  return {
    async availability() {
      try {
        await assertRepository();
      } catch (error) {
        // Only expected Git absence/non-repository failures are capability
        // unavailability. Identity mismatches, corrupt state and invalid policy
        // must remain explicit errors instead of being hidden from the caller.
        if (
          error instanceof GitCapabilityError &&
          (error.code === 'GIT_UNAVAILABLE' || error.code === 'NOT_GIT_REPOSITORY')
        ) {
          return { status: 'unavailable', reason: error.code };
        }
        throw error;
      }
      const policy = await loadGitWorktreePolicy(engine.context);
      return policy.enabled ? { status: 'available' } : { status: 'disabled' };
    },
    async plan(request) {
      await assertRepository();
      const policy = await loadGitWorktreePolicy(engine.context);
      if (!policy.enabled) {
        throw new GitCapabilityError('GIT_DISABLED', 'Managed worktree creation is disabled.');
      }
      const branch = resolveWorktreeBranch(
        policy,
        request.slug,
        request.shortId,
        request.branchOverride,
      );
      const targetPath = request.targetPath ?? join(parent, request.slug);
      const baseRef = request.baseRefOverride ?? policy.baseRef;
      const baseCommit = await git.resolveCommit(baseRef);
      const result: WorktreePlan = {
        projectId: engine.context.project.projectId,
        gitInstanceId: engine.context.project.gitInstanceId,
        projectRoot: home,
        baseCommit,
        branch,
        targetPath,
      };
      await validateReservedPlan(result);
      await git.validateBranch(branch);
      if ((await inspect(result)) !== 'absent') {
        throw new GitCapabilityError(
          'BRANCH_ALREADY_EXISTS',
          'Branch or worktree target is occupied.',
        );
      }
      return result;
    },
    validateReservedPlan,
    inspectEffect: inspect,
    async create(plan) {
      const policy = await loadGitWorktreePolicy(engine.context);
      if (!policy.enabled) {
        throw new GitCapabilityError('GIT_DISABLED', 'Managed worktree creation is disabled.');
      }
      await validateReservedPlan(plan);
      if ((await inspect(plan)) !== 'absent') {
        throw new GitCapabilityError(
          'GIT_OPERATION_UNCERTAIN',
          'Git state changed after preflight.',
        );
      }
      await mkdir(parent, { recursive: true });
      const stat = await lstat(parent);
      if (
        !stat.isDirectory() ||
        stat.isSymbolicLink() ||
        !sameFilesystemPath(await realpath(parent), parent)
      ) {
        throw new GitCapabilityError('WORKTREE_PATH_CONFLICT', 'Managed worktree parent changed.');
      }
      if ((await inspect(plan)) !== 'absent') {
        throw new GitCapabilityError(
          'GIT_OPERATION_UNCERTAIN',
          'Git state changed before mutation.',
        );
      }
      await git.addWorktree(plan);
    },
    async inspectCreated(plan) {
      await assertRepository();
      assertPlanIdentity(plan);
      const list: readonly LocalWorktreeFacts[] = await git.listWorktrees();
      const matching = list.filter((item) => sameFilesystemPath(item.root, plan.targetPath));
      if (
        matching.length !== 1 ||
        matching[0]!.prunable ||
        matching[0]!.branch !== 'refs/heads/' + plan.branch
      ) {
        throw new GitCapabilityError(
          'WORKTREE_MEMBERSHIP_MISMATCH',
          'Worktree path or branch no longer matches the original plan.',
        );
      }
      // A completed create may legitimately have advanced HEAD; the project's
      // linked physical workspace marker is verified by the Engine separately.
    },
  };
}

async function assertSafeTargetParents(target: string): Promise<void> {
  let path = parsePath(target).root;
  for (const part of relative(path, target).split(sep).filter(Boolean)) {
    path = join(path, part);
    const stat = await lstat(path).catch((error: unknown) => {
      if (isMissing(error)) return undefined;
      throw error;
    });
    if (!stat) continue;
    if (path === target || !stat.isDirectory() || stat.isSymbolicLink()) {
      throw new GitCapabilityError(
        'WORKTREE_PATH_CONFLICT',
        'Target exists or one of its parents is not a real directory.',
      );
    }
  }
}

function refsConflict(actual: string, candidate: string): boolean {
  const existing = actual.toLowerCase();
  const proposed = candidate.toLowerCase();
  return (
    existing === proposed ||
    existing.startsWith(proposed + '/') ||
    proposed.startsWith(existing + '/')
  );
}

/** Exact on case-sensitive filesystems; case-fold only for Windows paths. */
function sameFilesystemPath(a: string, b: string): boolean {
  const left = resolve(a);
  const right = resolve(b);
  return process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
}

function isMissing(value: unknown): boolean {
  return typeof value === 'object' && value !== null && 'code' in value && value.code === 'ENOENT';
}
