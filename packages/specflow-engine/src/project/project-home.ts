import { lstat, realpath, readFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';

import {
  isGitIgnored,
  LOCAL_CONFIG_RELATIVE_PATH,
  PROJECT_CONFIG_RELATIVE_PATH,
  resolveGitCheckoutLayout,
  runGit,
} from './git-checkout';

/**
 * Workstation-owned home designation. This is deliberately not committed:
 * it identifies one local clone/coordination scope, not a portable project ID.
 * Creation and migration are reserved for the initialization/coordination gate.
 */
export const PROJECT_HOME_MARKER_RELATIVE_PATH = '.nevo/local/state/project-home.json';
export const PROJECT_STATE_RELATIVE_PATH = '.nevo/local/state';

export type ProjectHomeErrorCode =
  | 'PROJECT_HOME_NOT_FOUND'
  | 'PROJECT_HOME_AMBIGUOUS'
  | 'PROJECT_HOME_INVALID'
  | 'PROJECT_HOME_MISMATCH';

export class ProjectHomeError extends Error {
  constructor(
    public readonly code: ProjectHomeErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ProjectHomeError';
  }
}

export interface ResolveProjectHomeOptions {
  readonly cwd: string;
  /** Verified, absolute override. Must identify a Git worktree of the caller's common repository. */
  readonly projectRoot?: string;
}

export interface ResolvedProjectHome {
  readonly project: {
    /** Local-only identity, never use as a portable HTTP authorization scope. */
    readonly projectId: string;
    readonly homeRoot: string;
    readonly gitCommonDir: string;
    readonly stateRoot: string;
    readonly projectConfigPath: string;
    readonly localConfigPath: string;
  };
  readonly workspace: {
    /** Verified current checkout. Stable workspaceId/registration are owned by E1.T04. */
    readonly root: string;
    readonly gitCommonDir: string;
  };
}

interface GitCheckout {
  readonly root: string;
  readonly commonDir: string;
}

interface HomeMarker {
  readonly version: 1;
  readonly projectId: string;
  readonly homeRoot: string;
  readonly gitCommonDir: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

/**
 * Resolve one existing designated Project Home without writing any state.
 * Git common-dir proves local repository membership; it does not select a home.
 * Exactly one valid local marker must select that home (unless a validated
 * operator override explicitly disambiguates).
 */
export async function resolveProjectHome(
  options: ResolveProjectHomeOptions,
): Promise<ResolvedProjectHome> {
  const caller = await inspectCheckout(options.cwd);
  const roots = await worktreeRoots(caller);
  if (!roots.includes(caller.root)) {
    throw new ProjectHomeError(
      'PROJECT_HOME_INVALID',
      'The current checkout is not registered in its Git worktree metadata.',
    );
  }

  let home: GitCheckout;
  let marker: HomeMarker;
  if (options.projectRoot !== undefined) {
    if (!isAbsolute(options.projectRoot)) {
      throw new ProjectHomeError('PROJECT_HOME_INVALID', 'Project Home override must be absolute.');
    }
    let requested: string;
    try {
      requested = await realpath(options.projectRoot);
    } catch (error) {
      if (!isMissing(error)) throw error;
      throw new ProjectHomeError(
        'PROJECT_HOME_NOT_FOUND',
        'The requested Project Home is unavailable.',
      );
    }
    if (!roots.includes(requested)) {
      throw new ProjectHomeError(
        'PROJECT_HOME_MISMATCH',
        'Project Home override is not a worktree of the invoking Git repository.',
      );
    }
    const selected = await readDesignatedHome(requested, caller.commonDir);
    if (!selected) {
      throw new ProjectHomeError(
        'PROJECT_HOME_NOT_FOUND',
        'The selected Project Home has no verified local designation.',
      );
    }
    home = selected.checkout;
    marker = selected.marker;
  } else {
    const designated: Array<{ checkout: GitCheckout; marker: HomeMarker }> = [];
    for (const root of roots) {
      const selected = await readDesignatedHome(root, caller.commonDir);
      if (selected) designated.push(selected);
    }
    if (designated.length === 0) {
      throw new ProjectHomeError(
        'PROJECT_HOME_NOT_FOUND',
        'No designated Project Home exists for this local Git repository. Repair or initialize explicitly.',
      );
    }
    if (designated.length > 1) {
      throw new ProjectHomeError(
        'PROJECT_HOME_AMBIGUOUS',
        'Multiple Project Home designations exist. Select a verified home explicitly; do not merge state automatically.',
      );
    }
    const selected = designated[0];
    if (!selected) {
      throw new ProjectHomeError('PROJECT_HOME_NOT_FOUND', 'Project Home not found.');
    }
    home = selected.checkout;
    marker = selected.marker;
  }

  return {
    project: {
      projectId: marker.projectId,
      homeRoot: home.root,
      gitCommonDir: home.commonDir,
      stateRoot: join(home.root, PROJECT_STATE_RELATIVE_PATH),
      projectConfigPath: join(home.root, PROJECT_CONFIG_RELATIVE_PATH),
      localConfigPath: join(home.root, LOCAL_CONFIG_RELATIVE_PATH),
    },
    workspace: {
      root: caller.root,
      gitCommonDir: caller.commonDir,
    },
  };
}

async function inspectCheckout(cwd: string): Promise<GitCheckout> {
  const layout = await resolveGitCheckoutLayout(cwd);
  const root = await realpath(layout.root);
  const result = await runGit(root, ['rev-parse', '--git-common-dir']);
  if (result.code !== 0 || !result.stdout.trim()) {
    throw new ProjectHomeError('PROJECT_HOME_INVALID', 'Unable to inspect Git common directory.');
  }
  return {
    root,
    commonDir: await realpath(resolve(root, result.stdout.trim())),
  };
}

async function worktreeRoots(caller: GitCheckout): Promise<string[]> {
  const result = await runGit(caller.root, ['worktree', 'list', '--porcelain', '-z']);
  if (result.code !== 0) {
    throw new ProjectHomeError('PROJECT_HOME_INVALID', 'Unable to enumerate Git worktrees.');
  }

  const roots = new Set<string>();
  for (const record of result.stdout.split('\0')) {
    if (!record.startsWith('worktree ')) continue;
    const raw = record.slice('worktree '.length);
    try {
      roots.add(await realpath(raw));
    } catch (error) {
      // Git may retain an unavailable worktree. Never use a stale path as a home
      // or create fallback state; absence is diagnosed by the final selection.
      if (!isMissing(error)) throw error;
    }
  }
  return [...roots];
}

async function readDesignatedHome(
  root: string,
  expectedCommonDir: string,
): Promise<{ checkout: GitCheckout; marker: HomeMarker } | undefined> {
  const markerPath = join(root, PROJECT_HOME_MARKER_RELATIVE_PATH);
  // Inspect the file and every parent before reading through them. A replaced
  // symlink must not redirect discovery to another workstation's local state.
  try {
    await lstat(markerPath);
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
  await requireDirectory(root, '.nevo');
  await requireDirectory(root, '.nevo/local');
  await requireDirectory(root, PROJECT_STATE_RELATIVE_PATH);
  await requirePlainFile(markerPath);
  await requirePlainFile(join(root, PROJECT_CONFIG_RELATIVE_PATH));
  const source = await readFile(markerPath, 'utf8');

  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    throw new ProjectHomeError('PROJECT_HOME_INVALID', 'Project Home marker is not valid JSON.');
  }
  if (!isHomeMarker(parsed)) {
    throw new ProjectHomeError(
      'PROJECT_HOME_INVALID',
      'Project Home marker has an unsupported schema or invalid local project identity.',
    );
  }

  const checkout = await inspectCheckout(root);
  if (
    checkout.root !== root ||
    checkout.commonDir !== expectedCommonDir ||
    parsed.gitCommonDir !== expectedCommonDir ||
    parsed.homeRoot !== root
  ) {
    throw new ProjectHomeError(
      'PROJECT_HOME_MISMATCH',
      'Project Home designation does not match the current Git repository or physical checkout.',
    );
  }
  if (!(await isGitIgnored(root, PROJECT_HOME_MARKER_RELATIVE_PATH))) {
    throw new ProjectHomeError(
      'PROJECT_HOME_INVALID',
      'Project Home marker is not ignored by Git; local identity must never be committed.',
    );
  }

  return { checkout, marker: parsed };
}

function isHomeMarker(value: unknown): value is HomeMarker {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const marker = value as Record<string, unknown>;
  return (
    marker.version === 1 &&
    typeof marker.projectId === 'string' &&
    UUID_PATTERN.test(marker.projectId) &&
    typeof marker.homeRoot === 'string' &&
    isAbsolute(marker.homeRoot) &&
    typeof marker.gitCommonDir === 'string' &&
    isAbsolute(marker.gitCommonDir)
  );
}

async function requireDirectory(root: string, relative: string): Promise<void> {
  const path = join(root, relative);
  let stat;
  try {
    stat = await lstat(path);
  } catch (error) {
    if (!isMissing(error)) throw error;
    throw new ProjectHomeError('PROJECT_HOME_INVALID', 'Project Home state directory is missing.');
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new ProjectHomeError(
      'PROJECT_HOME_INVALID',
      'Project Home state path is not a physical directory.',
    );
  }
}

async function requirePlainFile(path: string): Promise<void> {
  let stat;
  try {
    stat = await lstat(path);
  } catch (error) {
    if (!isMissing(error)) throw error;
    throw new ProjectHomeError(
      'PROJECT_HOME_INVALID',
      'Project Home marker/config file is missing.',
    );
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new ProjectHomeError(
      'PROJECT_HOME_INVALID',
      'Project Home marker/config must be regular files.',
    );
  }
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}
