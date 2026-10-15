import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { format, resolveConfig } from 'prettier';
import { it } from 'vitest';

// Temporary CI-only helper for obtaining the exact repository Prettier projection.
// Remove once the spec-discovery formatting issue is resolved.
it.skipIf(process.platform !== 'linux')('prints expected formatting of new discovery tests', async () => {
  const path = join(dirname(fileURLToPath(import.meta.url)), 'spec-discovery.test.ts');
  const source = await readFile(path, 'utf8');
  const output = await format(source, { ...(await resolveConfig(path)), filepath: path });
  console.info('FORMATTED_E2_T07_BEGIN\\n' + output.slice(output.indexOf("describe('E2.T07")) + '\\nFORMATTED_E2_T07_END');
});
