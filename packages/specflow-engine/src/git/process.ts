import { BoundedGitOutput, spawnLocalGit } from './process-shared';

import { GitCapabilityError } from './errors';

const MAX_OUTPUT_BYTES = 1024 * 1024;
const TIMEOUT_MS = 10000;

export interface GitCommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * Engine-owned local Git process boundary. Never use shell interpolation, an
 * ambient Git context or provider/Runtime process adapters.
 */
export async function executeGit(cwd: string, args: readonly string[]): Promise<GitCommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawnLocalGit(cwd, args);
    let done = false;
    const output = new BoundedGitOutput(MAX_OUTPUT_BYTES);

    const fail = (error: GitCapabilityError): void => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      child.kill();
      reject(error);
    };

    const timeout = setTimeout(() => {
      fail(new GitCapabilityError('GIT_UNAVAILABLE', 'Git command timed out.'));
    }, TIMEOUT_MS);
    timeout.unref();

    const collect = (channel: 'stdout' | 'stderr', data: Buffer): void => {
      if (!output.write(channel, data)) {
        fail(new GitCapabilityError('GIT_OPERATION_FAILED', 'Git output exceeds safety limit.'));
        return;
      }
    };

    child.stdout.on('data', (data: Buffer) => collect('stdout', data));
    child.stderr.on('data', (data: Buffer) => collect('stderr', data));
    child.on('error', () => {
      fail(new GitCapabilityError('GIT_UNAVAILABLE', 'Git executable is unavailable.'));
    });
    child.on('close', (code) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      resolve({ exitCode: code ?? -1, ...output.finish() });
    });
  });
}
