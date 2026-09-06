import { Command } from 'commander';

import type { GitHubAdminClient, Logger } from '../ports.js';
import { configureCommand } from './commands/configure.js';

export interface GithubCliContext {
  readonly client: GitHubAdminClient;
  readonly stdout: Logger;
  readonly stderr: Logger;
}

export function createProgram(ctx: GithubCliContext): Command {
  const program = new Command('nevo-repo-github')
    .description('Repository GitHub governance for nevo-specdev (not a product CLI)')
    .configureOutput({
      writeOut: (str) => ctx.stdout(str.replace(/\n$/, '')),
      writeErr: (str) => ctx.stderr(str.replace(/\n$/, '')),
    })
    .exitOverride();

  program.addCommand(configureCommand(ctx.client, ctx.stdout, ctx.stderr));
  return program;
}
