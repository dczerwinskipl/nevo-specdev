import { realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { executeGit } from '../git/process';

// This is a checkout-local bootstrap layout, NOT the canonical Project Home.
// Linked Git worktrees intentionally return different roots until the T03 resolver lands.
export const PROJECT_CONFIG_RELATIVE_PATH = '.nevo/config.yaml';
export const LOCAL_CONFIG_RELATIVE_PATH = '.nevo/local/config.yaml';
export const LOCAL_IGNORE_ENTRY = '.nevo/local/';

export interface GitCheckoutLayout {
  readonly root: string;
  readonly projectConfigPath: string;
  readonly localConfigPath: string;
}

export async function resolveGitCheckoutLayout(cwd: string): Promise<GitCheckoutLayout> {
  const result = await runGit(cwd, ['rev-parse', '--show-toplevel']);
  if (result.code !== 0) {
    throw new Error(
      `Nevo SpecFlow must be run inside a Git repository: ${result.stderr.trim() || 'git rev-parse failed'}`,
    );
  }

  const root = await realpath(resolve(result.stdout.trim()));
  return {
    root,
    projectConfigPath: join(root, PROJECT_CONFIG_RELATIVE_PATH),
    localConfigPath: join(root, LOCAL_CONFIG_RELATIVE_PATH),
  };
}

export async function isGitIgnored(root: string, relativePath: string): Promise<boolean> {
  const result = await runGit(root, ['check-ignore', '-q', '--', relativePath]);
  if (result.code === 0) return true;
  if (result.code === 1) return false;
  throw new Error(
    `Unable to verify Git ignore rules for ${relativePath}: ${result.stderr.trim() || `git check-ignore exited ${String(result.code)}`}`,
  );
}

interface GitResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** Bootstrap and discovery are read-only callers of the bounded Git adapter. */
export async function runGit(cwd: string, args: readonly string[]): Promise<GitResult> {
  const result = await executeGit(cwd, args);
  return { code: result.exitCode, stdout: result.stdout, stderr: result.stderr };
}
