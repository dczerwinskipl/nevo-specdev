import { spawn } from 'node:child_process';

import { GitOutputDecoder } from './output-decoder';

/** Sanitizes Git discovery/config overrides for every Engine process. */
export function spawnLocalGit(cwd: string, args: readonly string[]) {
  const env = { ...process.env };
  for (const name of Object.keys(env)) {
    if (name.toUpperCase().startsWith('GIT_')) delete env[name];
  }
  return spawn('git', [...args], {
    cwd,
    env,
    shell: false,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/** Shared bounded, incremental UTF-8 output handling; cancellation stays with each policy. */
export class BoundedGitOutput {
  private readonly decoder = new GitOutputDecoder();
  private bytes = 0;

  constructor(private readonly maxBytes: number) {}

  write(channel: 'stdout' | 'stderr', data: Buffer): boolean {
    this.bytes += data.byteLength;
    if (this.bytes > this.maxBytes) return false;
    this.decoder.write(channel, data);
    return true;
  }

  finish(): { readonly stdout: string; readonly stderr: string } {
    return this.decoder.finish();
  }
}
