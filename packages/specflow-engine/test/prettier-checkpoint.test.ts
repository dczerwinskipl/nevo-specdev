import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { format, resolveConfig } from 'prettier';
import { it } from 'vitest';

// Temporary CI-only formatter, removed before the final checkpoint commit.
it.skipIf(process.platform !== 'linux')('prints canonical formatting of changed files', async () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  const paths = [
    'packages/specflow-engine/test/durable-create.test.ts',
    'packages/specflow-engine/test/spec-discovery.test.ts',
    'packages/specflow-runtime/test/auth/authorization/configuration.test.ts',
  ];
  for (const path of paths) {
    const absolute = resolve(root, path);
    const source = await readFile(absolute, 'utf8');
    const formatted = await format(source, {
      ...(await resolveConfig(absolute)),
      filepath: absolute,
    });
    console.info('NEVO_FORMAT_JSON ' + JSON.stringify({ path, content: formatted }));
  }
}, 60000);
