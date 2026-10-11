import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { GitCheckoutLayout } from '@nevo/specflow-engine';
import { afterEach, describe, expect, it } from 'vitest';

import {
  assertProjectCanInitialize,
  type ConfigWriteOptions,
  initializeProject,
} from '../src/init/initialize-project';

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function repository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'specflow-init-'));
  dirs.push(root);
  await mkdir(join(root, '.git'));
  await mkdir(join(root, '.nevo', 'agents', 'definitions'), { recursive: true });
  return root;
}

function layout(root: string): GitCheckoutLayout {
  return {
    root,
    projectConfigPath: join(root, '.nevo', 'config.yaml'),
    localConfigPath: join(root, '.nevo', 'local', 'config.yaml'),
  };
}

const contribution = {
  projectConfig: { runtime: { marker: 'runtime-project' } },
  localConfig: { runtime: { marker: 'runtime-local' } },
};

describe('project initialization', () => {
  it('writes already-collected product contributions', async () => {
    const root = await repository();

    const result = await initializeProject({
      layout: layout(root),
      contribution,
      isIgnored: () => Promise.resolve(true),
    });

    expect(result.projectConfigPath).toBe(join(root, '.nevo', 'config.yaml'));
    expect(result.localConfigPath).toBe(join(root, '.nevo', 'local', 'config.yaml'));

    const project = await readFile(result.projectConfigPath, 'utf8');
    const local = await readFile(result.localConfigPath, 'utf8');
    const gitignore = await readFile(join(root, '.gitignore'), 'utf8');

    expect(project).toContain('runtime:');
    expect(project).toContain('marker: runtime-project');
    expect(local).toContain('runtime:');
    expect(local).toContain('marker: runtime-local');
    expect(gitignore).toContain('.nevo/local/');
  });

  it('does not leave staging files after successful initialization', async () => {
    const root = await repository();

    await initializeProject({
      layout: layout(root),
      contribution,
      isIgnored: () => Promise.resolve(true),
    });

    const nevoFiles = await readdir(join(root, '.nevo'), { recursive: true });
    expect(nevoFiles.some((path) => path.includes('.init.') && path.endsWith('.tmp'))).toBe(false);
  });

  it('rechecks admission at persistence time after an earlier wizard admission check', async () => {
    const root = await repository();
    const projectConfigPath = join(root, '.nevo', 'config.yaml');

    await assertProjectCanInitialize(layout(root));
    await writeFile(projectConfigPath, 'concurrent: project\n', 'utf8');

    await expect(
      initializeProject({
        layout: layout(root),
        contribution,
        isIgnored: () => Promise.resolve(true),
      }),
    ).rejects.toThrowError(/already initialized/);

    await expect(readFile(projectConfigPath, 'utf8')).resolves.toBe('concurrent: project\n');
    await expect(
      readFile(join(root, '.nevo', 'local', 'config.yaml'), 'utf8'),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('does not treat existing committed .nevo definitions as an initialized config', async () => {
    const root = await repository();

    await expect(
      initializeProject({
        layout: layout(root),
        contribution,
        isIgnored: () => Promise.resolve(true),
      }),
    ).resolves.toMatchObject({
      projectConfigPath: join(root, '.nevo', 'config.yaml'),
    });
  });

  it('refuses to write local secrets when Git ignore cannot be proven effective', async () => {
    const root = await repository();
    await writeFile(join(root, '.gitignore'), '.nevo/local/\n!.nevo/local/config.yaml\n', 'utf8');

    await expect(
      initializeProject({
        layout: layout(root),
        contribution,
        isIgnored: () => Promise.resolve(false),
      }),
    ).rejects.toThrowError(/Git does not ignore \.nevo\/local\/config\.yaml/);

    await expect(readFile(join(root, '.nevo', 'config.yaml'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect(await readFile(join(root, '.gitignore'), 'utf8')).toBe(
      '.nevo/local/\n!.nevo/local/config.yaml\n',
    );
  });

  it('appends a final canonical ignore rule when an existing rule is negated later', async () => {
    const root = await repository();
    await writeFile(join(root, '.gitignore'), '.nevo/local/\n!.nevo/local/config.yaml\n', 'utf8');
    const checks = [false, true];

    await initializeProject({
      layout: layout(root),
      contribution,
      isIgnored: () => Promise.resolve(checks.shift() ?? true),
    });

    expect((await readFile(join(root, '.gitignore'), 'utf8')).trimEnd()).toMatch(
      /\.nevo\/local\/$/u,
    );
  });

  it('rolls back local config and gitignore when the final project write fails', async () => {
    const root = await repository();
    await writeFile(join(root, '.gitignore'), 'node_modules/\n', 'utf8');

    const writeConfigFile = async (
      path: string,
      content: string,
      options: ConfigWriteOptions,
    ): Promise<void> => {
      if (!options.local) throw new Error('simulated project write failure');
      await writeFile(path, content, 'utf8');
    };

    await expect(
      initializeProject({
        layout: layout(root),
        contribution,
        isIgnored: () => Promise.resolve(true),
        writeConfigFile,
      }),
    ).rejects.toThrowError(/simulated project write failure/);

    await expect(
      readFile(join(root, '.nevo', 'local', 'config.yaml'), 'utf8'),
    ).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(join(root, '.nevo', 'config.yaml'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect(await readFile(join(root, '.gitignore'), 'utf8')).toBe('node_modules/\n');
  });
});
