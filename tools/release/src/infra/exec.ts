import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export class CommandFailedError extends Error {
  override readonly name = 'CommandFailedError';
  constructor(
    readonly command: string,
    readonly args: readonly string[],
    readonly stderr: string,
    /** process exit code, or `null` when the process was killed / never started. */
    readonly exitCode: number | null,
    options?: ErrorOptions,
  ) {
    super(`${command} ${args.join(' ')} failed:\n${stderr.trim()}`, options);
  }
}

export interface RunOptions {
  readonly cwd: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

/** Run a command, capturing stdout. Rejects with `CommandFailedError` on non-zero exit. */
export async function run(
  command: string,
  args: readonly string[],
  { cwd, env }: RunOptions,
): Promise<string> {
  try {
    const { stdout } = await execFileAsync(command, [...args], {
      cwd,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      ...(env ? { env: { ...process.env, ...env } } : {}),
    });
    return stdout;
  } catch (err) {
    const e = err as { stderr?: string; stdout?: string; code?: number | string };
    const exitCode = typeof e.code === 'number' ? e.code : null;
    throw new CommandFailedError(command, args, e.stderr ?? e.stdout ?? String(err), exitCode, {
      cause: err,
    });
  }
}

/** Like `run`, but writes `input` to the process stdin. */
export async function runWithInput(
  command: string,
  args: readonly string[],
  { cwd }: RunOptions,
  input: string,
): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(command, [...args], { cwd });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (d: string) => (stdout += d));
    child.stderr.on('data', (d: string) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new CommandFailedError(command, args, stderr || stdout, code));
    });
    child.stdin.end(input);
  });
}
