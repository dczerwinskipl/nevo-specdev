// Small child-process helpers. The packaging tool legitimately shells out to
// `pnpm` / `node`; keep it in one narrow place.

import { execFileSync } from 'node:child_process';

export interface RunOpts {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
}

export class StepFailedError extends Error {
  override readonly name = 'StepFailedError';
}

/** Run a command to completion, returning trimmed stdout. Throws `StepFailedError` on failure. */
export function run(command: string, args: readonly string[], opts: RunOpts = {}): string {
  try {
    return execFileSync(command, [...args], {
      cwd: opts.cwd,
      env: opts.env,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      // `pnpm` is a shell script on Windows; `shell: true` lets it resolve.
      shell: process.platform === 'win32',
    }).trim();
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; status?: number | null };
    throw new StepFailedError(
      `\`${command} ${args.join(' ')}\` failed (exit ${String(e.status ?? 'null')})\n` +
        `${(e.stderr ?? '').trim() || (e.stdout ?? '').trim()}`,
      { cause: err },
    );
  }
}
