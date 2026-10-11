import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';

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

  const root = resolve(result.stdout.trim());
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

function runGit(cwd: string, args: readonly string[]): Promise<GitResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('git', [...args], {
      cwd,
      // Discover from the supplied directory, never an inherited Git context
      // (GIT_DIR, GIT_WORK_TREE, GIT_COMMON_DIR or Git config injection).
      env: gitDiscoveryEnvironment(),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.once('error', reject);
    child.once('close', (code) => {
      resolvePromise({
        code: code ?? -1,
        stdout,
        stderr,
      });
    });
  });
}

/**
 * Git's repository-discovery variables can point at a completely different
 * checkout than `cwd`. These bootstrap reads must inspect the requested
 * directory, even when invoked inside hooks, worktrees or another Git process.
 *
 * Preserve PATH/HOME and the rest of the process environment, but remove all
 * Git-specific overrides, including GIT_CONFIG_COUNT and its GIT_CONFIG_KEY_N / GIT_CONFIG_VALUE_N entries.
 * The filter is case-insensitive for Windows environment semantics.
 */
function gitDiscoveryEnvironment(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.toUpperCase().startsWith('GIT_')) {
      delete env[key];
    }
  }
  return env;
}
