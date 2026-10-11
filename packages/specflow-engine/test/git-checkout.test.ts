import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { isGitIgnored, resolveGitCheckoutLayout } from '../src/index';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'specflow-engine-checkout-'));
  temporaryRoots.push(root);
  return root;
}

describe('Engine Git checkout bootstrap boundary', () => {
  it('resolves a checkout root without requiring the Runtime', async () => {
    const root = await tempRoot();
    execFileSync('git', ['init', '-q'], { cwd: root });

    await expect(resolveGitCheckoutLayout(root)).resolves.toEqual({
      root,
      projectConfigPath: join(root, '.nevo', 'config.yaml'),
      localConfigPath: join(root, '.nevo', 'local', 'config.yaml'),
    });
  });

  it('rejects a non-Git location without initializing files', async () => {
    const root = await tempRoot();
    await expect(resolveGitCheckoutLayout(root)).rejects.toThrow(/inside a Git repository/u);
    expect(await readdir(root)).toEqual([]);
  });

  it('ignores inherited Git repository and config overrides for checkout discovery and ignore checks', async () => {
    const requested = await tempRoot();
    const foreign = await tempRoot();
    const nonGit = await tempRoot();
    execFileSync('git', ['init', '-q'], { cwd: requested });
    execFileSync('git', ['init', '-q'], { cwd: foreign });
    await writeFile(join(requested, '.gitignore'), '.nevo/local/\n', 'utf8');
    await writeFile(join(foreign, '.gitignore'), 'node_modules/\n', 'utf8');

    const overrides = {
      GIT_DIR: join(foreign, '.git'),
      GIT_WORK_TREE: foreign,
      GIT_COMMON_DIR: join(foreign, '.git'),
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'core.worktree',
      GIT_CONFIG_VALUE_0: foreign,
      GIT_PREFIX: 'nested/',
    };
    const original = Object.fromEntries(
      Object.keys(overrides).map((key) => [key, process.env[key]]),
    );

    try {
      Object.assign(process.env, overrides);
      await expect(resolveGitCheckoutLayout(requested)).resolves.toMatchObject({
        root: requested,
      });
      await expect(isGitIgnored(requested, '.nevo/local/config.yaml')).resolves.toBe(true);
      await expect(resolveGitCheckoutLayout(nonGit)).rejects.toThrow(
        /inside a Git repository/u,
      );
      expect(await readdir(nonGit)).toEqual([]);
    } finally {
      for (const [key, value] of Object.entries(original)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it('keeps linked worktree checkout paths distinct (not yet Project Home)', async () => {
    const root = await tempRoot();
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync(
      'git',
      [
        '-c',
        'user.name=SpecFlow Test',
        '-c',
        'user.email=specflow@example.invalid',
        'commit',
        '--allow-empty',
        '-q',
        '-m',
        'bootstrap',
      ],
      { cwd: root },
    );
    const linked = await tempRoot();
    execFileSync('git', ['worktree', 'add', '--detach', linked], { cwd: root });

    const primary = await resolveGitCheckoutLayout(root);
    const secondary = await resolveGitCheckoutLayout(linked);
    expect(primary.root).toBe(root);
    expect(secondary.root).toBe(linked);
    expect(secondary.root).not.toBe(primary.root);
  });
});
