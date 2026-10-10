// The `nevo-specflow` composition root. `@nevo/specflow` owns the CLI shell:
// root program, global flags, version, output/error/exit conventions, and command
// composition. Capability verticals own their own Commander adapters.

import {
  createAuthCommand,
  createStartCommand,
  type AuthCommandContext,
  type RuntimeCommandContext,
} from '@nevo/specflow-runtime/cli';
import type { RuntimeSetupUi } from '@nevo/specflow-runtime';
import { Command } from 'commander';

import { createProjectInitCommand, type ProjectInitCommandContext } from './init/cli';
import { startProjectRuntime } from './runtime/start-project-runtime';
import { NEVO_SPECFLOW_VERSION } from './version';

export interface ProgramIO {
  readonly stdout: (line: string) => void;
  readonly stderr: (line: string) => void;
  readonly signal?: AbortSignal;
  readonly startRuntime?: RuntimeCommandContext['start'];
  readonly readPasswordFromStdin?: AuthCommandContext['readPasswordFromStdin'];
  readonly cwd?: string;
  readonly initUi?: RuntimeSetupUi;
  readonly initializeProject?: ProjectInitCommandContext['initialize'];
}

export function createProgram(io: ProgramIO): Command {
  const program = new Command('nevo-specflow')
    .description('Nevo SpecFlow — spec-driven development for AI-assisted software engineering')
    .version(NEVO_SPECFLOW_VERSION, '-v, --version', 'print the installed nevo-specflow version')
    .configureOutput({
      writeOut: (s) => io.stdout(s.replace(/\n$/, '')),
      writeErr: (s) => io.stderr(s.replace(/\n$/, '')),
    })
    .showHelpAfterError();

  program.addCommand(
    createProjectInitCommand({
      cwd: io.cwd ?? '.',
      stdout: io.stdout,
      ...(io.initUi ? { ui: io.initUi } : {}),
      ...(io.initializeProject ? { initialize: io.initializeProject } : {}),
    }),
  );

  program.addCommand(
    createAuthCommand({
      stdout: io.stdout,
      ...(io.readPasswordFromStdin ? { readPasswordFromStdin: io.readPasswordFromStdin } : {}),
    }),
  );

  program.addCommand(
    createStartCommand({
      stdout: io.stdout,
      start: io.startRuntime ?? ((options) => startProjectRuntime(io.cwd ?? '.', {}, options)),
      ...(io.signal ? { signal: io.signal } : {}),
    }),
  );

  program.exitOverride();
  for (const cmd of program.commands) cmd.exitOverride();

  return program;
}
