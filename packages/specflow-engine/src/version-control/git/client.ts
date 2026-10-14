import { realpath } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';

import { GitCapabilityError } from '../../git/errors';
import { executeGitMutation } from '../../git/mutation';
import { executeGit } from '../../git/process';
import { normalizeBaseRef, validateBranchName } from './refs';

export interface LocalWorktreeFacts {
  readonly root: string;
  readonly head: string;
  readonly branch?: string;
  readonly prunable: boolean;
}

/** Internal typed Git plumbing. No generic executeGit operation escapes to product features. */
export interface LocalGitClient {
  inspectRepository(): Promise<string>;
  listWorktrees(): Promise<readonly LocalWorktreeFacts[]>;
  listLocalRefs(): Promise<readonly string[]>;
  validateBranch(branch: string): Promise<void>;
  resolveCommit(ref: string): Promise<string>;
  verifyBaseProjectConfig(commit: string): Promise<void>;
  addWorktree(plan: {
    readonly branch: string;
    readonly targetPath: string;
    readonly baseCommit: string;
  }): Promise<void>;
}

const OBJECT_ID = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/iu;

export function createLocalGitClient(home: string): LocalGitClient {
  const read = async (args: readonly string[]) => executeGit(home, args);
  const requireSuccess = async (args: readonly string[], message: string): Promise<string> => {
    const result = await read(args);
    if (result.exitCode !== 0) throw new GitCapabilityError('GIT_OPERATION_FAILED', message);
    return result.stdout;
  };
  return {
    async inspectRepository() {
      const result = await read(['rev-parse', '--git-common-dir']);
      if (result.exitCode !== 0 || !result.stdout.trim()) {
        throw new GitCapabilityError('NOT_GIT_REPOSITORY', 'Project Home is not a Git repository.');
      }
      try {
        return await realpath(resolve(home, result.stdout.trim()));
      } catch {
        throw new GitCapabilityError(
          'NOT_GIT_REPOSITORY',
          'Git repository metadata is unavailable.',
        );
      }
    },
    async listWorktrees() {
      const raw = await requireSuccess(
        ['worktree', 'list', '--porcelain', '-z'],
        'Unable to inspect Git worktrees.',
      );
      return parseWorktrees(raw);
    },
    async listLocalRefs() {
      const raw = await requireSuccess(
        ['for-each-ref', '--format=%(refname)', 'refs/heads'],
        'Unable to inspect Git branches.',
      );
      return raw.split('\n').filter(Boolean);
    },
    async validateBranch(branch) {
      validateBranchName(branch);
      const result = await read(['check-ref-format', '--branch', branch]);
      if (result.exitCode !== 0) {
        throw new GitCapabilityError('GIT_POLICY_INVALID', 'Git rejected the branch name.');
      }
    },
    async resolveCommit(ref) {
      const name = normalizeBaseRef(ref);
      const value = await read(['rev-parse', '--verify', '--end-of-options', name + '^{commit}']);
      const commit = value.stdout.trim();
      if (value.exitCode !== 0 || !OBJECT_ID.test(commit)) {
        throw new GitCapabilityError(
          'BASE_REF_NOT_FOUND',
          'Base reference does not resolve to a commit.',
        );
      }
      return commit;
    },
    async verifyBaseProjectConfig(commit) {
      if (!OBJECT_ID.test(commit)) {
        throw new GitCapabilityError('BASE_REF_NOT_FOUND', 'Invalid base commit object ID.');
      }
      const tree = await read(['ls-tree', '-z', commit, '--', '.nevo/config.yaml']);
      if (
        tree.exitCode !== 0 ||
        !/^(?:100644|100755) blob [a-f0-9]{40}(?:[a-f0-9]{24})?\t\.nevo\/config\.yaml\0$/u.test(
          tree.stdout,
        )
      ) {
        throw new GitCapabilityError(
          'GIT_BASE_CONFIG_MISSING',
          'Base commit must contain a regular project configuration file.',
        );
      }
      const config = await read(['show', commit + ':.nevo/config.yaml']);
      let parsed: unknown;
      try {
        if (config.exitCode !== 0) throw new Error('Missing config.');
        parsed = parseYaml(config.stdout) as unknown;
      } catch {
        throw new GitCapabilityError(
          'GIT_BASE_CONFIG_MISSING',
          'Invalid base project configuration.',
        );
      }
      if (!isRecord(parsed) || !isRecord(parsed.runtime)) {
        throw new GitCapabilityError(
          'GIT_BASE_CONFIG_MISSING',
          'Invalid base project configuration.',
        );
      }
    },
    async addWorktree(plan) {
      // A nonzero result is not proof of zero Git effects; the Engine journal
      // must fence retries until explicit quiescence and evidence reconciliation.
      const result = await executeGitMutation(home, [
        'worktree',
        'add',
        '-b',
        plan.branch,
        plan.targetPath,
        plan.baseCommit,
      ]);
      if (result.exitCode !== 0) {
        throw new GitCapabilityError(
          'GIT_OPERATION_UNCERTAIN',
          'Git worktree creation may have changed repository state; reconciliation required.',
        );
      }
    },
  };
}

function parseWorktrees(raw: string): readonly LocalWorktreeFacts[] {
  const items: LocalWorktreeFacts[] = [];
  let current: { root: string; head?: string; branch?: string; prunable: boolean } | undefined;
  const flush = (): void => {
    if (!current) return;
    if (!OBJECT_ID.test(current.head ?? '')) {
      throw new GitCapabilityError('GIT_OPERATION_FAILED', 'Incomplete Git worktree metadata.');
    }
    items.push({
      root: current.root,
      head: current.head!,
      ...(current.branch ? { branch: current.branch } : {}),
      prunable: current.prunable,
    });
    current = undefined;
  };
  for (const item of raw.split('\0')) {
    if (!item) {
      flush();
    } else if (item.startsWith('worktree ')) {
      flush();
      const value = item.slice('worktree '.length);
      if (!isAbsolute(value)) {
        throw new GitCapabilityError(
          'GIT_OPERATION_FAILED',
          'Git returned a relative worktree path.',
        );
      }
      current = { root: resolve(value), prunable: false };
    } else if (item.startsWith('HEAD ') && current) {
      current.head = item.slice('HEAD '.length);
    } else if (item.startsWith('branch ') && current) {
      current.branch = item.slice('branch '.length);
    } else if (item.startsWith('prunable ') && current) {
      current.prunable = true;
    } else {
      throw new GitCapabilityError('GIT_OPERATION_FAILED', 'Invalid Git worktree metadata.');
    }
  }
  flush();
  return items;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
