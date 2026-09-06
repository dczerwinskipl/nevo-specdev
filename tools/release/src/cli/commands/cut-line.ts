import { Command, Option } from 'commander';

import { executeReleaseCut } from '../../app/cut-release-line.js';
import { hasReleaseToken, wantsExecute, type CliContext } from '../context.js';

interface CutLineOptions {
  releaseVersion?: string;
  nextDevelopmentVersion?: string;
  execute: boolean;
}

export function cutLineCommand(ctx: CliContext): Command {
  return new Command('cut-line')
    .description('Cut a maintained release/vX.Y line off the current origin/main')
    .addOption(
      new Option('--release-version <x.y.z>', 'the version to stabilize on the new line')
        .env('RELEASE_VERSION')
        .makeOptionMandatory(),
    )
    .addOption(
      new Option('--next-development-version <x.y.z>', 'the next alpha version for main')
        .env('NEXT_DEVELOPMENT_VERSION')
        .makeOptionMandatory(),
    )
    .option('--execute', 'perform the cut (otherwise run every check, change nothing)', false)
    .action(async (opts: CutLineOptions) => {
      const mutate = wantsExecute(opts.execute, ctx.env);
      const { events } = await executeReleaseCut(
        {
          releaseVersion: opts.releaseVersion ?? '',
          nextDevelopmentVersion: opts.nextDevelopmentVersion ?? '',
        },
        { git: ctx.git, github: ctx.github, hasToken: hasReleaseToken(ctx.env) },
        { mutate },
      );
      for (const e of events) (e.level === 'warn' ? ctx.stderr : ctx.stdout)(e.message);
      if (!mutate) ctx.stdout('\nvalidate-only: every check passed; nothing was changed.');
    });
}
