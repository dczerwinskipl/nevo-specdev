import { lstat, readFile, realpath } from 'node:fs/promises';
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

import { parse as parseYaml } from 'yaml';

import type { SpecFlowEngine } from '../application';
import { isValidSpecificationId, validateSpecificationSlug } from '../specs/model';
import { GitCapabilityError } from './errors';
import { executeGit } from './process';

export interface GitWorktreeFacts {
  readonly root: string;
  readonly head: string;
  readonly branch?: string;
  readonly isCurrent: boolean;
  readonly prunable: boolean;
}

export interface NewWorktreeRequest {
  readonly specId: string;
  readonly slug: string;
  /** HEAD means the designated Project Home checkout's HEAD, never caller cwd. */
  readonly baseRef: string;
  /** Defaults to spec/<slug>-<specId-prefix>. */
  readonly branch?: string;
  /** Only a direct child of the canonical project worktrees directory is supported. */
  readonly targetPath?: string;
}

export interface GitWorktreePlan {
  readonly projectId: string;
  readonly gitInstanceId: string;
  readonly projectRoot: string;
  readonly baseCommit: string;
  readonly branch: string;
  readonly targetPath: string;
  readonly specId: string;
}

export interface GitCapability {
  /** Git repository presence does not imply Git worktree automation enablement. */
  isEnabled(): Promise<boolean>;
  inspectCurrentCheckout(): Promise<GitWorktreeFacts>;
  listWorktrees(): Promise<readonly GitWorktreeFacts[]>;
  /** Side-effect-free preflight. E2.T04 must revalidate under its durable reservation. */
  planNewWorktree(input: NewWorktreeRequest): Promise<GitWorktreePlan>;
}

export function openGitCapability(engine: SpecFlowEngine): GitCapability {
  const home = engine.context.project.homeRoot;
  const current = engine.workspace.root;
  const gitCommonDir = engine.context.project.gitCommonDir;

  const assertRepository = async (): Promise<void> => {
    // Registry reads verify the current physical checkout, Project Home and
    // durable Git instance sentinel even if the Engine was opened earlier.
    await engine.readRegistry();
    const result = await executeGit(home, ['rev-parse', '--git-common-dir']);
    if (result.exitCode !== 0 || !result.stdout.trim()) {
      throw new GitCapabilityError(
        'NOT_GIT_REPOSITORY',
        'Project Home has no usable Git repository.',
      );
    }
    let commonDir: string;
    try {
      commonDir = await realpath(resolve(home, result.stdout.trim()));
    } catch {
      throw new GitCapabilityError(
        'WORKTREE_MEMBERSHIP_MISMATCH',
        'Project Home Git common directory is unavailable.',
      );
    }
    if (commonDir !== gitCommonDir) {
      throw new GitCapabilityError(
        'WORKTREE_MEMBERSHIP_MISMATCH',
        'Project Home Git repository identity changed.',
      );
    }
  };

  const list = async (): Promise<readonly GitWorktreeFacts[]> => {
    await assertRepository();
    const result = await executeGit(home, ['worktree', 'list', '--porcelain', '-z']);
    if (result.exitCode !== 0) {
      throw new GitCapabilityError('GIT_OPERATION_FAILED', 'Cannot inspect Git worktrees.');
    }
    return parseWorktreeList(result.stdout, current);
  };

  const isEnabled = async (): Promise<boolean> => {
    await assertRepository();
    const project = await readProjectYaml(engine.context.project.projectConfigPath);
    const localPath = engine.context.project.localConfigPath;
    const local = await readOptionalLocalYaml(localPath);
    if (local?.git !== undefined) {
      throw new GitCapabilityError(
        'GIT_POLICY_INVALID',
        'Git capability is project-owned and cannot be overridden in workstation-local config.',
      );
    }
    if (project.git === undefined) return false;
    if (
      !isRecord(project.git) ||
      typeof project.git.enabled !== 'boolean' ||
      Object.keys(project.git).some((key) => key !== 'enabled')
    ) {
      throw new GitCapabilityError(
        'GIT_POLICY_INVALID',
        'Project Git capability requires a strict git.enabled boolean.',
      );
    }
    return project.git.enabled;
  };

  return {
    isEnabled,
    async inspectCurrentCheckout() {
      const worktrees = await list();
      const selected = worktrees.find((item) => pathKey(item.root) === pathKey(current));
      if (!selected || selected.prunable) {
        throw new GitCapabilityError(
          'WORKTREE_MEMBERSHIP_MISMATCH',
          'Invoking checkout is unavailable or not registered in Git worktree metadata.',
        );
      }
      return selected;
    },
    listWorktrees: list,
    async planNewWorktree(input) {
      // Check policy FIRST. Disabled automation must not reserve branch/path or
      // invoke any mutating Git operation.
      if (!(await isEnabled())) {
        throw new GitCapabilityError('GIT_DISABLED', 'Git worktree automation is disabled.');
      }
      if (!isValidSpecificationId(input.specId)) {
        throw new GitCapabilityError('WORKTREE_PATH_CONFLICT', 'Valid stable specId required.');
      }
      const slug = validateSpecificationSlug(input.slug);
      const branch = input.branch ?? 'spec/' + slug + '-' + input.specId.slice(0, 8);
      if (
        !branch.startsWith('spec/') ||
        !/^spec\/[a-z0-9][a-z0-9._/-]*$/u.test(branch) ||
        branch.includes('..') ||
        branch.endsWith('.') ||
        branch.includes('//')
      ) {
        throw new GitCapabilityError('GIT_OPERATION_FAILED', 'Unsupported Git branch name.');
      }
      const branchCheck = await executeGit(home, ['check-ref-format', '--branch', branch]);
      if (branchCheck.exitCode !== 0) {
        throw new GitCapabilityError('GIT_OPERATION_FAILED', 'Invalid Git branch name.');
      }

      const root = dirname(home);
      const parent = join(root, basename(home) + '-worktrees');
      const targetPath = input.targetPath ?? join(parent, slug);
      if (
        !isAbsolute(targetPath) ||
        resolve(targetPath) !== targetPath ||
        pathKey(targetPath) !== pathKey(join(parent, slug))
      ) {
        throw new GitCapabilityError(
          'WORKTREE_PATH_CONFLICT',
          'New worktree must be a direct child of the project-owned worktree directory.',
        );
      }

      // Inspect existing filesystem ancestors without creating missing dirs.
      await assertSafeNewTarget(targetPath);
      const worktrees = await list();
      if (worktrees.some((item) => pathKey(item.root) === pathKey(targetPath))) {
        throw new GitCapabilityError(
          'WORKTREE_PATH_CONFLICT',
          'Worktree path is already registered.',
        );
      }
      if (worktrees.some((item) => item.branch === 'refs/heads/' + branch)) {
        throw new GitCapabilityError(
          'BRANCH_ALREADY_CHECKED_OUT',
          'Requested branch is checked out in another Git worktree.',
        );
      }

      // Ref collisions are invalid even when not checked out. Use Git-native
      // validation and conservatively reject case-only differences on POSIX.
      const branches = await executeGit(home, [
        'for-each-ref',
        '--format=%(refname)',
        'refs/heads',
      ]);
      if (branches.exitCode !== 0) {
        throw new GitCapabilityError('GIT_OPERATION_FAILED', 'Cannot inspect local Git branches.');
      }
      const requestedRef = 'refs/heads/' + branch;
      if (branches.stdout.split('\n').some((ref) => gitRefsConflict(ref, requestedRef))) {
        throw new GitCapabilityError(
          'BRANCH_ALREADY_EXISTS',
          'Requested branch conflicts with an existing Git ref.',
        );
      }

      const baseRef = input.baseRef;
      if (
        baseRef !== 'HEAD' &&
        !/^refs\/(?:heads|tags)\/[a-zA-Z0-9][a-zA-Z0-9._/-]*$/u.test(baseRef) &&
        !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/iu.test(baseRef)
      ) {
        throw new GitCapabilityError('BASE_REF_NOT_FOUND', 'Unsupported Git base reference.');
      }
      const verified = await executeGit(home, [
        'rev-parse',
        '--verify',
        '--end-of-options',
        baseRef + '^{commit}',
      ]);
      const baseCommit = verified.stdout.trim();
      if (verified.exitCode !== 0 || !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/iu.test(baseCommit)) {
        throw new GitCapabilityError('BASE_REF_NOT_FOUND', 'Base reference is not a Git commit.');
      }
      // A Git symlink is also a blob (mode 120000); cat-file -t alone
      // cannot establish a regular file. Reject Git links/submodules before
      // checking YAML so a checkout on another OS cannot redirect config.
      const tree = await executeGit(home, ['ls-tree', '-z', baseCommit, '--', '.nevo/config.yaml']);
      if (
        tree.exitCode !== 0 ||
        !/^(?:100644|100755) blob [a-f0-9]{40}(?:[a-f0-9]{24})?\t\.nevo\/config\.yaml\0$/u.test(
          tree.stdout,
        )
      ) {
        throw new GitCapabilityError(
          'GIT_BASE_CONFIG_MISSING',
          'Base commit must contain a regular, non-symlink SpecFlow configuration file.',
        );
      }
      const configContent = await executeGit(home, ['show', baseCommit + ':.nevo/config.yaml']);
      if (configContent.exitCode !== 0) {
        throw new GitCapabilityError(
          'GIT_BASE_CONFIG_MISSING',
          'Base commit configuration could not be read.',
        );
      }
      let baseConfig: unknown;
      try {
        baseConfig = parseYaml(configContent.stdout) as unknown;
      } catch {
        throw new GitCapabilityError(
          'GIT_BASE_CONFIG_MISSING',
          'Base commit project configuration is not valid YAML.',
        );
      }
      if (!isRecord(baseConfig) || !isRecord(baseConfig.runtime)) {
        throw new GitCapabilityError(
          'GIT_BASE_CONFIG_MISSING',
          'Base commit must contain a valid project config with a runtime object.',
        );
      }

      return {
        projectId: engine.context.project.projectId,
        gitInstanceId: engine.context.project.gitInstanceId,
        projectRoot: home,
        baseCommit,
        branch,
        targetPath,
        specId: input.specId,
      };
    },
  };
}

function parseWorktreeList(source: string, current: string): readonly GitWorktreeFacts[] {
  const result: GitWorktreeFacts[] = [];
  let item: { root: string; head?: string; branch?: string; prunable: boolean } | undefined;
  const push = (): void => {
    if (!item) return;
    if (!item.head || !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/iu.test(item.head)) {
      throw new GitCapabilityError('GIT_OPERATION_FAILED', 'Incomplete Git worktree metadata.');
    }
    result.push({
      root: item.root,
      head: item.head,
      ...(item.branch ? { branch: item.branch } : {}),
      isCurrent: pathKey(item.root) === pathKey(current),
      prunable: item.prunable,
    });
    item = undefined;
  };
  for (const line of source.split('\0')) {
    if (!line) {
      push();
      continue;
    }
    if (line.startsWith('worktree ')) {
      push();
      // Validate Git's raw metadata before native separator normalization:
      // resolve() would incorrectly turn a relative path into an absolute one.
      const rawRoot = line.slice('worktree '.length);
      if (!isAbsolute(rawRoot)) {
        throw new GitCapabilityError(
          'GIT_OPERATION_FAILED',
          'Git returned a non-absolute worktree.',
        );
      }
      // Git for Windows may emit POSIX separators even for native Windows roots.
      item = { root: resolve(rawRoot), prunable: false };
    } else if (line.startsWith('HEAD ')) {
      if (!item) {
        throw new GitCapabilityError('GIT_OPERATION_FAILED', 'Invalid Git worktree record.');
      }
      item.head = line.slice('HEAD '.length);
    } else if (line.startsWith('branch ')) {
      if (!item) {
        throw new GitCapabilityError('GIT_OPERATION_FAILED', 'Invalid Git worktree branch.');
      }
      item.branch = line.slice('branch '.length);
    } else if (line.startsWith('prunable ')) {
      if (!item) {
        throw new GitCapabilityError('GIT_OPERATION_FAILED', 'Invalid Git worktree state.');
      }
      item.prunable = true;
    }
  }
  push();
  return result;
}

async function assertSafeNewTarget(target: string): Promise<void> {
  const filesystemRoot = parsePath(target).root;
  let candidate = filesystemRoot;
  const segments = relative(filesystemRoot, target).split(sep).filter(Boolean);
  for (const segment of segments) {
    candidate = join(candidate, segment);
    try {
      const stat = await lstat(candidate);
      if (candidate === target || !stat.isDirectory() || stat.isSymbolicLink()) {
        throw new GitCapabilityError(
          'WORKTREE_PATH_CONFLICT',
          'Worktree target exists or its parent is not a physical directory.',
        );
      }
    } catch (error) {
      if (isMissing(error)) continue;
      throw error;
    }
  }
}

async function readProjectYaml(path: string): Promise<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = parseYaml(await readFile(path, 'utf8')) as unknown;
  } catch {
    throw new GitCapabilityError(
      'GIT_POLICY_INVALID',
      'Project configuration is unavailable or invalid.',
    );
  }
  if (!isRecord(parsed)) {
    throw new GitCapabilityError('GIT_POLICY_INVALID', 'Project configuration must be an object.');
  }
  return parsed;
}

async function readOptionalLocalYaml(path: string): Promise<Record<string, unknown> | undefined> {
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new GitCapabilityError('GIT_POLICY_INVALID', 'Local configuration is redirected.');
    }
    return readProjectYaml(path);
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
}

/**
 * Git stores refs as hierarchical paths: refs/heads/spec/example blocks
 * refs/heads/spec/example/task and vice versa. Match component boundaries,
 * not arbitrary string prefixes, and conservatively ignore case on all OSes.
 */
function gitRefsConflict(existingRef: string, requestedRef: string): boolean {
  const existing = existingRef.toLowerCase();
  const requested = requestedRef.toLowerCase();
  return (
    existing === requested ||
    existing.startsWith(requested + '/') ||
    requested.startsWith(existing + '/')
  );
}

function pathKey(path: string): string {
  // Git for Windows emits forward slashes. Compare native-normalized paths,
  // conservatively rejecting case-only collisions even on POSIX.
  return resolve(path).toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMissing(error: unknown): boolean {
  return isRecord(error) && error.code === 'ENOENT';
}
