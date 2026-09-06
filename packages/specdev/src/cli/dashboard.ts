// `nevo-spec dashboard` — routes into the sibling capability package.
//
// The boundary:  CLI command  ->  capability API (@nevo/specdev-dashboard)  ->
// typed result  ->  CLI presenter. The capability package knows nothing about
// Commander; this file owns the command name, help text, stdout and exit code.

import { runDashboard } from '@nevo/specdev-dashboard';
import { Command } from 'commander';

import type { ProgramIO } from '../program.js';

export function dashboardCommand(io: ProgramIO): Command {
  return new Command('dashboard')
    .description('Nevo SpecDev dashboard (bootstrap — does not start the dashboard yet)')
    .action(() => {
      const result = runDashboard();
      io.stdout(result.message);
    });
}
