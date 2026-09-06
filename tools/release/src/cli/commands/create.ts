import { Command, Option } from 'commander';

import { executeRelease } from '../../app/create-release.js';
import { planRelease } from '../../domain/release-plan.js';
import { UsageError } from '../../errors.js';
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
    .option('--execute', 'perform the release (otherwise validate only)', false)
    .action(async (opts: CreateOptions) => {
      await ctx.git.fetch();
      const branch = await ctx.git.currentBranch();
      const existingTags = await ctx.git.listTags();

      const plan = planRelease({
        branch,
        channel: opts.channel ?? '',
        versionFile: ctx.readWorkingVersion(),
        existingTags,
      });
      if (!plan.ok) {
        throw new UsageError(`Cannot release:\n  - ${plan.errors.join('\n  - ')}`);
      }

      ctx.stdout('Plan');
      ctx.stdout(`  branch  : ${branch}`);
      ctx.stdout(`  channel : ${plan.channel}`);
      ctx.stdout(`  tag     : ${plan.tag}${plan.prerelease ? '  (prerelease)' : ''}`);
      if (plan.nextBranchState) {
        ctx.stdout(
          `  then    : advance ${branch} -> { channel: "${plan.nextBranchState.channel}", ` +
            `version: "${plan.nextBranchState.version}" }`,
        );
      }

      if (!wantsExecute(opts.execute, ctx.env)) {
        ctx.stdout('');
        ctx.stdout('--execute not set: validated only, no tag created.');
        return;
      }

      const { events } = await executeRelease(plan, {
        git: ctx.git,
        github: ctx.github,
        hasToken: hasReleaseToken(ctx.env),
      });
      for (const e of events) (e.level === 'warn' ? ctx.stderr : ctx.stdout)(e.message);
    });
}
