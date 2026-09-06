#!/usr/bin/env node
// Executable boundary for the packaging tool.

import process from 'node:process';

import { CommanderError } from 'commander';

import { createProgram } from './cli.js';

async function main(argv: string[]): Promise<number> {
  const program = createProgram({
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
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${message}\n`);
    return 1;
  }
}

process.exitCode = await main(process.argv);
