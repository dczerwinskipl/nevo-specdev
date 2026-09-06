import { Command, Option } from 'commander';

import { promoteRelease } from '../../app/promote.js';
import { hasCiGithubReleaseToken, wantsExecute, type CliContext } from '../context.js';

interface PromoteOptions {
  target?: string;
  execute: boolean;
}

export function promoteCommand(ctx: CliContext): Command {
  return new Command('promote')
    .description(
      'Promote the current release/vX.Y branch a channel forward (beta->rc, rc->stable) via a PR',
    )
    .addOption(
      new Option('--target <rc|stable>', 'the channel to promote to')
        .choices(['rc', 'stable'])
        .env('PROMOTE_TARGET')
        .makeOptionMandatory(),
    )
    .option('--execute', 'open the promotion PR (otherwise run every check, change nothing)', false)
    .action(async (opts: PromoteOptions) => {
      const mutate = wantsExecute(opts.execute, ctx.env);
      const { events } = await promoteRelease(
        { target: opts.target ?? '' },
        { git: ctx.git, github: ctx.github, hasToken: hasCiGithubReleaseToken(ctx.env) },
        { mutate },
      );
      for (const e of events) (e.level === 'warn' ? ctx.stderr : ctx.stdout)(e.message);
      if (!mutate) ctx.stdout('\nvalidate-only: every check passed; nothing was changed.');
    });
}
