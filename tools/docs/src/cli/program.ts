import { Command } from 'commander';

import { adrCommand } from './commands/adr.js';
import { checkCommand } from './commands/check.js';
import { contextCommand } from './commands/context.js';
import { findCommand } from './commands/find.js';
import { listCommand } from './commands/list.js';
import type { DocsCliContext } from './context.js';

/** Build the `nevo-docs` program. Pure wiring — no argv parsing here. */
export function createProgram(ctx: DocsCliContext): Command {
  const program = new Command('nevo-docs')
    .description('Repository documentation discovery, index and ADR authoring (not a product CLI)')
    .configureOutput({
      writeOut: (str) => ctx.stdout(str.replace(/\n$/, '')),
      writeErr: (str) => ctx.stderr(str.replace(/\n$/, '')),
    });

  program.addCommand(listCommand(ctx));
  program.addCommand(findCommand(ctx));
  program.addCommand(contextCommand(ctx));
  program.addCommand(checkCommand(ctx));
  program.addCommand(adrCommand(ctx));

  // Route every exit (help, parse error, our thrown errors) through bin.ts.
  program.exitOverride();
  for (const cmd of program.commands) {
    cmd.exitOverride();
    for (const sub of cmd.commands) sub.exitOverride();
  }

  return program;
}
