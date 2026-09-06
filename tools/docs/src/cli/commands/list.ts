import { Command } from 'commander';

import { findDocuments } from '../../app/find-documents.js';
import type { DocsCliContext } from '../context.js';

export function listCommand(ctx: DocsCliContext): Command {
  return new Command('list')
    .description('List every indexed document (all statuses)')
    .option('--type <type>', 'filter by doc type')
    .option('--status <status>', 'filter by status')
    .option('--json', 'emit JSON on stdout', false)
    .action((opts: { type?: string; status?: string; json: boolean }) => {
      const docs = findDocuments(ctx.repo, { type: opts.type, status: opts.status });
      if (opts.json) {
        ctx.stdout(JSON.stringify(docs, null, 2));
        return;
      }
      if (docs.length === 0) {
        ctx.stdout('(no documents match)');
        return;
      }
      for (const d of docs) {
        ctx.stdout(`${String(d.id).padEnd(40)} ${String(d.status).padEnd(10)} ${d.file}`);
      }
    });
}
