#!/usr/bin/env node
// Executable boundary — construct dependencies, run the Commander program, and
// map a thrown error to an exit code. No domain logic lives here.

import process from 'node:process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CommanderError } from 'commander';

import { createProgram } from './cli/program.js';
import { ReleaseToolError, UsageError } from './errors.js';
import { createGitClient } from './infra/git.js';
import { createSyncGitReader } from './infra/git-sync.js';
import { createGitHubClient } from './infra/github.js';
import { findRepoRoot, readWorkingVersion } from './infra/repo.js';

async function main(argv: string[]): Promise<number> {
  const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)));
  const program = createProgram({
    git: createGitClient(repoRoot),
    github: createGitHubClient(repoRoot),
    syncGit: createSyncGitReader(repoRoot),
    readWorkingVersion: () => readWorkingVersion(repoRoot),
    env: process.env,
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
    if (err instanceof ReleaseToolError) return 1;
    return 1;
  }
}

const exitCode = await main(process.argv);
process.exitCode = exitCode;
