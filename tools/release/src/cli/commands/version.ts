import { Command } from 'commander';

import { resolveBuildVersion } from '../../app/build-version.js';
import type { CliContext } from '../context.js';

export function versionCommand(ctx: CliContext): Command {
  return new Command('version')
    .description('Print the CI build version for the current branch / ref')
    .option('--with-sha', 'append +<short-sha> build metadata', false)
    .action((opts: { withSha: boolean }) => {
      const value = resolveBuildVersion(ctx.readWorkingVersion(), ctx.env, {
        withSha: opts.withSha,
      });
      ctx.stdout(value);
    });
}
