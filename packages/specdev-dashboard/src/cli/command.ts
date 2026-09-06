// The `dashboard` command — a CLI ADAPTER owned by the dashboard package, not by
// the `nevo-spec` shell. It knows the command name, its (future) `--port` /
// `--host` / `--open` options, its subcommands, and how to map CLI input onto
// the dashboard capability API. Commander is a dependency of THIS adapter only —
// it never reaches the capability/runtime in `../index.ts`.
//
// The composition root (`@nevo/specdev`) does `program.addCommand(
// createDashboardCommand(ctx))` — it registers the command, it does not define it.

import { Command } from 'commander';

import { runDashboard } from '../index.js';

/** What the shell hands the command: a place to write human output. */
export interface DashboardCommandContext {
  readonly stdout: (line: string) => void;
}

export function createDashboardCommand(ctx: DashboardCommandContext): Command {
  return new Command('dashboard')
    .description('Nevo SpecDev dashboard (bootstrap — does not start the dashboard yet)')
    .action(() => {
      const result = runDashboard();
      ctx.stdout(result.message);
    });
}
