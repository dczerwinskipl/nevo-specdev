// The `nevo-spec` composition root. `@nevo/specdev` owns the CLI SHELL — the root
// program, global flags, version, and the output / error / exit conventions —
// and COMPOSES top-level commands. It does not define them: each capability
// vertical owns its own Commander adapter (`@nevo/specdev-dashboard/cli`
// exports `createDashboardCommand`), the same way a feature owns its HTTP routes
// while the server root just mounts them.

import { createDashboardCommand } from '@nevo/specdev-dashboard/cli';
import { Command } from 'commander';

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
 *   nevo-spec dashboard   (defined in @nevo/specdev-dashboard/cli)
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

  program.addCommand(createDashboardCommand({ stdout: io.stdout }));

  // Route every exit (help, version, parse error) through the caller.
  program.exitOverride();
  for (const cmd of program.commands) cmd.exitOverride();

  return program;
}
