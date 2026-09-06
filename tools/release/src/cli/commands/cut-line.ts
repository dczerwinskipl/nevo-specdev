import { Command, Option } from 'commander';

import { executeReleaseCut } from '../../app/cut-release-line.js';
import { planReleaseCut } from '../../domain/cut-plan.js';
import { UsageError } from '../../errors.js';
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
    .option('--execute', 'perform the cut (otherwise validate only)', false)
    .action(async (opts: CutLineOptions) => {
      const plan = planReleaseCut({
        releaseVersion: opts.releaseVersion ?? '',
        nextDevelopmentVersion: opts.nextDevelopmentVersion ?? '',
      });
      if (!plan.ok) {
        throw new UsageError(`Invalid inputs:\n  - ${plan.errors.join('\n  - ')}`);
      }

      ctx.stdout('Plan');
      ctx.stdout(`  release branch : ${plan.releaseBranch}  (from origin/main)`);
      ctx.stdout(`  branch version : { channel: "beta", version: "${plan.releaseVersion}" }`);
      ctx.stdout(
        `  main moves to  : { channel: "alpha", version: "${plan.nextVersion}" }  ` +
          `(${plan.step} step, PR ${plan.bumpBranch})`,
      );

      if (!wantsExecute(opts.execute, ctx.env)) {
        ctx.stdout('');
        ctx.stdout('--execute not set: validated only, nothing changed.');
        return;
      }

      const { events } = await executeReleaseCut(plan, {
        git: ctx.git,
        github: ctx.github,
        hasToken: hasReleaseToken(ctx.env),
      });
      for (const e of events) (e.level === 'warn' ? ctx.stderr : ctx.stdout)(e.message);
    });
}
