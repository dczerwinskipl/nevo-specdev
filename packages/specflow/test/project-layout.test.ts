import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  isGitIgnored,
  LOCAL_CONFIG_RELATIVE_PATH,
  resolveGitCheckoutLayout,
} from '@nevo/specflow-engine';

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function gitRepository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'specflow-layout-'));
  dirs.push(root);
  execFileSync('git', ['init', '-q'], { cwd: root });
  return root;
}

describe('project layout', () => {
  it('resolves the Git root from a nested working directory', async () => {
    const root = await gitRepository();
    const nested = join(root, 'packages', 'demo');
    await mkdir(nested, { recursive: true });

    const layout = await resolveGitCheckoutLayout(nested);

    expect(layout.root).toBe(root);
    expect(layout.projectConfigPath).toBe(join(root, '.nevo', 'config.yaml'));
    expect(layout.localConfigPath).toBe(join(root, '.nevo', 'local', 'config.yaml'));
  });

  it('uses Git semantics so a later negation makes the local config non-ignored', async () => {
    const root = await gitRepository();
    await writeFile(
      join(root, '.gitignore'),
      '.nevo/local/\n!.nevo/local/\n!.nevo/local/config.yaml\n',
      'utf8',
    );

    await expect(isGitIgnored(root, LOCAL_CONFIG_RELATIVE_PATH)).resolves.toBe(false);

    await writeFile(
      join(root, '.gitignore'),
      '.nevo/local/\n!.nevo/local/\n!.nevo/local/config.yaml\n.nevo/local/\n',
      'utf8',
    );

    await expect(isGitIgnored(root, LOCAL_CONFIG_RELATIVE_PATH)).resolves.toBe(true);
  });
});
