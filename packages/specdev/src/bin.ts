// Executable boundary for `nevo-spec`. Construct IO, run the Commander program,
// map a thrown error to an exit code. No product logic here. The shebang is
// added by the packaging tool's esbuild banner, not written in source.

import process from 'node:process';

import { CommanderError } from 'commander';

import { createProgram } from './program.js';

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
      // `--help` / `--version` are a successful exit; a parse/usage error is 2.
      if (err.code === 'commander.helpDisplayed' || err.code === 'commander.version') return 0;
      return 2;
    }
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }
}

process.exitCode = await main(process.argv);
