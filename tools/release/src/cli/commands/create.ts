import { Command, Option } from 'commander';

import { executeRelease } from '../../app/create-release.js';
import { hasReleaseToken, wantsExecute, type CliContext } from '../context.js';

interface CreateOptions {
  channel?: string;
  execute: boolean;
}

export function createReleaseCommand(ctx: CliContext): Command {
  return new Command('create')
    .description('Create the Git tag + GitHub Release for the current release/vX.Y branch')
    .addOption(
      new Option('--channel <beta|rc|stable>', 'the channel to release')
        .choices(['beta', 'rc', 'stable'])
        .env('RELEASE_CHANNEL')
        .makeOptionMandatory(),
    )
    .option('--execute', 'perform the release (otherwise run every check, change nothing)', false)
    .action(async (opts: CreateOptions) => {
      const mutate = wantsExecute(opts.execute, ctx.env);
      const { events } = await executeRelease(
        { channel: opts.channel ?? '' },
        { git: ctx.git, github: ctx.github, hasToken: hasReleaseToken(ctx.env) },
        { mutate },
      );
      for (const e of events) (e.level === 'warn' ? ctx.stderr : ctx.stdout)(e.message);
      if (!mutate) ctx.stdout('\nvalidate-only: every check passed; nothing was changed.');
    });
}
