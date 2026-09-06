import { Command } from 'commander';

import { getContext } from '../../app/find-documents.js';
import { UsageError } from '../../errors.js';
import type { DocsCliContext } from '../context.js';

export function contextCommand(ctx: DocsCliContext): Command {
  return new Command('context')
    .description('Print the files to load for a task (deprecated/superseded excluded)')
    .argument('<query...>', 'task description terms')
    .option('--limit <n>', 'maximum files', '5')
    .option('--json', 'emit JSON on stdout', false)
    .action((queryParts: string[], opts: { limit: string; json: boolean }) => {
      const query = queryParts.join(' ').trim();
      if (!query) throw new UsageError('context: a query is required');
      const limit = Number(opts.limit) || 5;
      const entries = getContext(ctx.repo, { query, limit });

      if (opts.json) {
        ctx.stdout(JSON.stringify(entries, null, 2));
        return;
      }
      if (entries.length === 0) {
        ctx.stdout(`(no context found for "${query}")`);
        return;
      }
      ctx.stdout(`# Context for: ${query}`);
      ctx.stdout('# Read these files, most relevant first:');
      ctx.stdout('');
      for (const e of entries) {
        ctx.stdout(e.file);
        if (e.summary) ctx.stdout(`  ${e.summary.replace(/\s+/g, ' ').trim()}`);
      }
    });
}
