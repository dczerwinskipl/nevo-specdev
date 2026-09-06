import { Command } from 'commander';

import { checkVersionTransition } from '../../app/check-transition.js';
import { InconsistentStateError } from '../../errors.js';
import type { CliContext } from '../context.js';

export function checkTransitionCommand(ctx: CliContext): Command {
  return new Command('check-transition')
    .description('Validate the working-tree version.json change against the branch it lands on')
    .option('--json', 'emit the result as JSON on stdout', false)
    .action((opts: { json: boolean }) => {
      const outcome = checkVersionTransition({
        git: ctx.syncGit,
        readWorkingVersion: ctx.readWorkingVersion,
        env: ctx.env,
      });

      if (opts.json) {
        ctx.stdout(JSON.stringify(outcome));
        if (outcome.kind === 'illegal') {
          throw new InconsistentStateError(`Illegal version.json transition: ${outcome.error}`);
        }
        return;
      }

      if (outcome.kind === 'skipped') {
        ctx.stdout(
          `no version.json at ${outcome.baseRef} (${outcome.source}) — skipping transition check`,
        );
        return;
      }
      if (outcome.kind === 'ok') {
        ctx.stdout(
          `version.json ${outcome.from.channel} ${outcome.from.version} -> ` +
            `${outcome.to.channel} ${outcome.to.version} on ${outcome.targetBranch} ` +
            `(${outcome.source}): ${outcome.transition}`,
        );
        return;
      }
      throw new InconsistentStateError(
        `Illegal version.json transition on '${outcome.targetBranch}' (${outcome.source}):\n` +
          `  ${outcome.from.channel} ${outcome.from.version} -> ` +
          `${outcome.to.channel} ${outcome.to.version}\n` +
          `  ${outcome.error}\n` +
          `See docs/development/releasing.md for the legal transitions.`,
      );
    });
}
