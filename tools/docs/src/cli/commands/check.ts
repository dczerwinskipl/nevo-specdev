import { Command } from 'commander';

import { validateDocumentation } from '../../app/validate-documentation.js';
import { DocsToolError } from '../../errors.js';
import type { DocsCliContext } from '../context.js';

export function checkCommand(ctx: DocsCliContext): Command {
  return new Command('check')
    .description('Validate the whole corpus and verify (or regenerate) the generated index')
    .option('--write', 'regenerate docs/index.generated.{md,json} when the corpus is clean', false)
    .action((opts: { write: boolean }) => {
      const result = validateDocumentation(ctx.repo, { write: opts.write });
      if (result.wroteIndex) {
        ctx.stdout('Wrote docs/index.generated.json and docs/index.generated.md');
      }
      if (result.problems.length) {
        for (const p of result.problems) ctx.stderr(p);
        if (!opts.write) ctx.stderr('Run `pnpm docs:check --write` to regenerate the index.');
        throw new DocsToolError(
          `documentation check failed (${String(result.problems.length)} problem${
            result.problems.length === 1 ? '' : 's'
          })`,
        );
      }
      ctx.stdout(`OK — ${String(result.docCount)} documents, corpus valid, index current.`);
    });
}
