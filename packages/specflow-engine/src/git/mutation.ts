import { spawn } from 'node:child_process';

import { GitCapabilityError } from './errors';
import { GitOutputDecoder } from './output-decoder';
import type { GitCommandResult } from './process';

const MAX_OUTPUT_BYTES = 1024 * 1024;
const TIMEOUT_MS = 30000;
const TERMINATION_GRACE_MS = 3000;

/**
 * Dedicated mutating Git adapter. Unlike read-only Git probes, a timeout is
 * NEVER a proof of no side effects. Wait for close after requesting termination
 * and always report uncertainty if timeout/output overflow occurred.
 *
 * The caller must first persist an intent and must not automatically replay an
 * uncertain result without external-process quiescence + Git evidence.
 */
export async function executeGitMutation(
  cwd: string,
  args: readonly string[],
): Promise<GitCommandResult> {
  const env = { ...process.env };
  for (const name of Object.keys(env)) {
    if (name.toUpperCase().startsWith('GIT_')) delete env[name];
  }

  return new Promise((resolve, reject) => {
    const child = spawn('git', [...args], {
      cwd,
      env,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const output = new GitOutputDecoder();
    let outputBytes = 0;
    let uncertain = false;
    let settled = false;
    let terminationTimer: NodeJS.Timeout | undefined;

    const settle = (outcome: GitCommandResult | GitCapabilityError): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (terminationTimer) clearTimeout(terminationTimer);
      if (outcome instanceof GitCapabilityError) reject(outcome);
      else resolve(outcome);
    };

    const terminate = (): void => {
      if (uncertain || settled) return;
      uncertain = true;
      child.kill();
      terminationTimer = setTimeout(() => {
        settle(
          new GitCapabilityError(
            'GIT_OPERATION_UNCERTAIN',
            'Mutating Git process did not terminate after cancellation; explicit recovery required.',
          ),
        );
      }, TERMINATION_GRACE_MS);
      terminationTimer.unref();
    };
    const timeout = setTimeout(terminate, TIMEOUT_MS);
    timeout.unref();

    const collect = (channel: 'stdout' | 'stderr', data: Buffer): void => {
      outputBytes += data.byteLength;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        terminate();
        return;
      }
      output.write(channel, data);
    };
    child.stdout.on('data', (data: Buffer) => collect('stdout', data));
    child.stderr.on('data', (data: Buffer) => collect('stderr', data));
    child.on('error', () => {
      settle(
        new GitCapabilityError(
          'GIT_OPERATION_UNCERTAIN',
          'Mutating Git process could not be started or observed reliably.',
        ),
      );
    });
    child.on('close', (code) => {
      if (uncertain) {
        settle(
          new GitCapabilityError(
            'GIT_OPERATION_UNCERTAIN',
            'Mutating Git execution was interrupted; inspect effects before retrying.',
          ),
        );
      } else {
        settle({ exitCode: code ?? -1, ...output.finish() });
      }
    });
  });
}
