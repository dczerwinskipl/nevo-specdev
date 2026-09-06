import { Command } from 'commander';

import type { CliContext } from './context.js';
import { checkTransitionCommand } from './commands/check-transition.js';
import { createReleaseCommand } from './commands/create.js';
import { cutLineCommand } from './commands/cut-line.js';
import { versionCommand } from './commands/version.js';

/** Build the `nevo-release` program. Pure wiring — no argv parsing here. */
export function createProgram(ctx: CliContext): Command {
  const program = new Command('nevo-release')
    .description('Repository release + version tooling for nevo-specdev (not a product CLI)')
    .configureOutput({
      writeOut: (str) => ctx.stdout(str.replace(/\n$/, '')),
      writeErr: (str) => ctx.stderr(str.replace(/\n$/, '')),
    });

  program.addCommand(versionCommand(ctx));
  program.addCommand(checkTransitionCommand(ctx));
  program.addCommand(cutLineCommand(ctx));
  program.addCommand(createReleaseCommand(ctx));

  // Route every exit (help, parse error, our thrown errors) through bin.ts.
  program.exitOverride();
  for (const cmd of program.commands) cmd.exitOverride();

  return program;
}
