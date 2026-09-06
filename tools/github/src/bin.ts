#!/usr/bin/env node
import process from 'node:process';

import { CommanderError } from 'commander';

import { createProgram } from './cli/program.js';
import { GithubToolError, UsageError } from './errors.js';
import { createGhClient } from './infra/gh-client.js';

async function main(argv: string[]): Promise<number> {
  const program = createProgram({
    client: createGhClient(),
    stdout: (line) => process.stdout.write(`${line}\n`),
    stderr: (line) => process.stderr.write(`${line}\n`),
  });

  try {
    await program.parseAsync(argv);
    return 0;
  } catch (err) {
    if (err instanceof CommanderError) {
      if (err.code === 'commander.helpDisplayed' || err.code === 'commander.version') return 0;
      return 2;
    }
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    if (err instanceof UsageError) return 2;
    if (err instanceof GithubToolError) return 1;
    return 1;
  }
}

const exitCode = await main(process.argv);
process.exitCode = exitCode;
