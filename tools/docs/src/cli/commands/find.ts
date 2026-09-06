import { Command } from 'commander';

import { findDocuments } from '../../app/find-documents.js';
import { UsageError } from '../../errors.js';
import type { ScoredDoc } from '../../domain/search.js';
import type { DocsCliContext } from '../context.js';

export function findCommand(ctx: DocsCliContext): Command {
  return new Command('find')
    .description('Rank documents by a query')
    .argument('<query...>', 'search terms')
    .option('--type <type>', 'filter by doc type')
    .option('--status <status>', 'filter by status')
    .option('--limit <n>', 'maximum results', '10')
    .option('--json', 'emit JSON on stdout', false)
    .action(
      (
        queryParts: string[],
        opts: { type?: string; status?: string; limit: string; json: boolean },
      ) => {
        const query = queryParts.join(' ').trim();
        if (!query) throw new UsageError('find: a query is required');
        const limit = Number(opts.limit) || 10;
        const results = findDocuments(ctx.repo, {
          query,
          type: opts.type,
          status: opts.status,
          limit,
        });
        if (opts.json) {
          ctx.stdout(JSON.stringify(results, null, 2));
          return;
        }
        if (results.length === 0) {
          ctx.stdout(`(no documents match "${query}")`);
          return;
        }
        for (const d of results) {
          ctx.stdout(`${String(d.id)} — "${String(d.title)}"  ${d.file}`);
          const scored = d as Partial<ScoredDoc>;
          const why: string[] = [];
          if (scored.matchedTerms?.length) why.push(`terms: ${scored.matchedTerms.join(', ')}`);
          if (scored.matchedFields?.length) why.push(`in: ${scored.matchedFields.join(', ')}`);
          if (why.length) ctx.stdout(`    (${why.join('; ')})`);
        }
      },
    );
}
