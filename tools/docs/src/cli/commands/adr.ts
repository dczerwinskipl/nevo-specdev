import { Command } from 'commander';

import { createAdr } from '../../app/create-adr.js';
import { UsageError } from '../../errors.js';
import type { DocsCliContext } from '../context.js';

export function adrCommand(ctx: DocsCliContext): Command {
  const adr = new Command('adr').description('Architecture Decision Record authoring');

  adr
    .command('new')
    .description('Create the next-numbered ADR from the template (as a draft)')
    .argument('<title...>', 'the decision title')
    .option('--dry-run', 'print the file that would be created; write nothing', false)
    .option('--json', 'emit JSON on stdout', false)
    .action((titleParts: string[], opts: { dryRun: boolean; json: boolean }) => {
      const title = titleParts.join(' ').trim();
      if (!title) throw new UsageError('adr new: a title is required');

      const result = createAdr(ctx.repo, { title, dryRun: opts.dryRun });

      if (opts.dryRun) {
        if (opts.json) {
          ctx.stdout(JSON.stringify(result.plan, null, 2));
          return;
        }
        ctx.stdout(`# would create ${result.plan.file}\n`);
        ctx.stdout(result.plan.content);
        return;
      }

      if (opts.json) {
        ctx.stdout(JSON.stringify({ ...result.plan, indexRegenerated: true }, null, 2));
        return;
      }
      ctx.stdout(`Created ${result.plan.file} (status: draft)`);
      ctx.stdout('Regenerated docs/index.generated.{md,json}');
      ctx.stdout(
        'Fill in the TODO sections, then promote status to `current` when the decision is adopted.',
      );
    });

  return adr;
}
