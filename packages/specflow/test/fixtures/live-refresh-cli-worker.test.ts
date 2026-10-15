import { writeFile } from 'node:fs/promises';

import { it } from 'vitest';

import { createProgram } from '../../src/program';

it.skipIf(!process.env.NEVO_LIVE_REFRESH_ROOT)(
  'creates a canonical Spec through an independent CLI process',
  async () => {
    const lines: string[] = [];
    const program = createProgram({
      cwd: process.env.NEVO_LIVE_REFRESH_ROOT!,
      stdout: (line) => lines.push(line),
      stderr: (line) => {
        throw new Error(line);
      },
    });

    await program.parseAsync([
      'node',
      'nevo-specflow',
      'specs',
      'create',
      '--title',
      process.env.NEVO_LIVE_REFRESH_TITLE!,
      '--json',
    ]);

    if (lines.length !== 1) {
      throw new Error('Expected exactly one JSON result from independent CLI create.');
    }
    await writeFile(process.env.NEVO_LIVE_REFRESH_RESULT!, lines[0]!);
  },
  120000,
);
