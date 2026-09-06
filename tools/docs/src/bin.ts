#!/usr/bin/env node
// Executable boundary — construct dependencies, run the Commander program, map a
// thrown error to an exit code. No domain logic here.

import process from 'node:process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CommanderError } from 'commander';

import { createProgram } from './cli/program.js';
import { DocsToolError, UsageError } from './errors.js';
import { createFileSystemDocRepository, findRepoRoot } from './infra/doc-repository.js';

async function main(argv: string[]): Promise<number> {
  const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)));
  const program = createProgram({
    repo: createFileSystemDocRepository({ repoRoot, docsDir: join(repoRoot, 'docs') }),
    stdout: (line) => process.stdout.write(`${line}\n`),
    stderr: (line) => process.stderr.write(`${line}\n`),
  });

  const jsonMode = argv.includes('--json');
  try {
    await program.parseAsync(argv);
    return 0;
  } catch (err) {
    if (err instanceof CommanderError) {
      if (err.code === 'commander.helpDisplayed' || err.code === 'commander.version') return 0;
      return 2;
    }
    const message = err instanceof Error ? err.message : String(err);
    if (jsonMode) {
      const type = err instanceof Error ? err.name : 'Error';
      process.stdout.write(`${JSON.stringify({ error: { type, message } })}\n`);
    } else {
      process.stderr.write(`${message}\n`);
    }
    if (err instanceof UsageError) return 2;
    if (err instanceof DocsToolError) return 1;
    return 1;
  }
}

const exitCode = await main(process.argv);
process.exitCode = exitCode;
