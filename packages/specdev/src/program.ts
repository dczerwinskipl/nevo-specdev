// The `nevo-spec` command router. Thin Commander composition — no product logic
// lives here, and no product logic lives in the executable (`bin.ts`). Each
// command handler calls a capability API and presents the result.

import { Command } from 'commander';

import { dashboardCommand } from './cli/dashboard.js';
import { NEVO_SPEC_VERSION } from './version.js';

/** Line sinks so the program never touches `process` directly (testable). */
export interface ProgramIO {
  readonly stdout: (line: string) => void;
  readonly stderr: (line: string) => void;
}

/**
 * Build the `nevo-spec` program. Pure wiring — argv is parsed by the caller.
 * The real command tree is intentionally minimal for this bootstrap:
 *   nevo-spec --help
 *   nevo-spec --version
 *   nevo-spec dashboard
 */
export function createProgram(io: ProgramIO): Command {
  const program = new Command('nevo-spec')
    .description('Nevo SpecDev — spec-driven development for AI-assisted software engineering')
    .version(NEVO_SPEC_VERSION, '-v, --version', 'print the installed nevo-spec version')
    .configureOutput({
      writeOut: (s) => io.stdout(s.replace(/\n$/, '')),
      writeErr: (s) => io.stderr(s.replace(/\n$/, '')),
    })
    .showHelpAfterError();

  program.addCommand(dashboardCommand(io));

  // Route every exit (help, version, parse error) through the caller.
  program.exitOverride();
  for (const cmd of program.commands) cmd.exitOverride();

  return program;
}
