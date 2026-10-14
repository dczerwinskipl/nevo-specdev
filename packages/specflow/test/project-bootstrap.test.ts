import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  PROJECT_HOME_MARKER_RELATIVE_PATH,
  bootstrapProjectHome,
  openSpecFlowEngine,
  readWorkspaceRegistry,
  workspaceRegistryPath,
} from '@nevo/specflow-engine';
import { afterEach, describe, expect, it } from 'vitest';
import type { RuntimeSetupUi } from '@nevo/specflow-runtime';

import { createProgram } from '../src/program';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function git(root: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'specflow-bootstrap-Ż ')));
  roots.push(root);
  git(root, 'init', '-q');
  await mkdir(join(root, '.nevo'), { recursive: true });
  await writeFile(join(root, '.nevo/config.yaml'), 'runtime: {}\n');
  await writeFile(join(root, '.gitignore'), '.nevo/local/\n');
  git(root, 'add', '.gitignore', '.nevo/config.yaml');
  git(
    root,
    '-c',
    'user.name=SpecFlow Test',
    '-c',
    'user.email=specflow@example.invalid',
    'commit',
    '-qm',
    'bootstrap',
  );
  return root;
}

async function invoke(cwd: string, ...args: string[]) {
  const out: string[] = [];
  const program = createProgram({
    cwd,
    stdout: (line) => out.push(line),
    stderr: () => undefined,
  });
  await program.parseAsync(['node', 'nevo-specflow', ...args]);
  return out.join('\n');
}

describe('Explicit Project Home bootstrap', () => {
  it('designates one durable home and makes offline CLI inspection available', async () => {
    const primary = await fixture();
    const before = await readFile(join(primary, '.nevo/config.yaml'), 'utf8');
    expect(await invoke(primary, 'project', 'bootstrap')).toContain('Project Home initialized');
    const engine = await bootstrapFailureProof(primary);
    const registry = await readWorkspaceRegistry(engine.context);
    const marker = JSON.parse(
      await readFile(join(primary, PROJECT_HOME_MARKER_RELATIVE_PATH), 'utf8'),
    ) as { projectId: string; primaryWorkspaceId: string; registryBootstrap: string };
    expect(marker.registryBootstrap).toBe('claimed');
    expect(marker.projectId).toBe(engine.context.project.projectId);
    expect(marker.primaryWorkspaceId).toBe(registry.primaryWorkspaceId);
    expect(await readFile(join(primary, '.nevo/config.yaml'), 'utf8')).toBe(before);
    const inspection = JSON.parse(await invoke(primary, 'project', 'inspect', '--json')) as {
      projectId: string;
      workspaceId: string;
    };
    expect(inspection.projectId).toBe(marker.projectId);
    expect(inspection.workspaceId).toBe(marker.primaryWorkspaceId);
  });

  it('does not overwrite a designated home or its registry on a second bootstrap', async () => {
    const primary = await fixture();
    const engine = await bootstrapProjectHome(primary);
    const previous = await readFile(workspaceRegistryPath(engine.context), 'utf8');
    await expect(bootstrapProjectHome(primary)).rejects.toMatchObject({
      code: 'PROJECT_HOME_INVALID',
    });
    expect(await readFile(workspaceRegistryPath(engine.context), 'utf8')).toBe(previous);
  });

  it('refuses to invent a new primary identity if registry evidence already exists', async () => {
    const primary = await fixture();
    const previous = '{"version":1,"doNotOverwrite":true}\n';
    await mkdir(join(primary, '.nevo/local/state'), { recursive: true });
    await writeFile(join(primary, '.nevo/local/state/workspaces.json'), previous);
    await expect(bootstrapProjectHome(primary)).rejects.toMatchObject({
      code: 'PROJECT_HOME_INVALID',
    });
    expect(await readFile(join(primary, '.nevo/local/state/workspaces.json'), 'utf8')).toBe(
      previous,
    );
    await expect(
      readFile(join(primary, PROJECT_HOME_MARKER_RELATIVE_PATH), 'utf8'),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('does not designate a linked worktree instead of the primary checkout', async () => {
    const primary = await fixture();
    const linked = await realpath(await mkdtemp(join(tmpdir(), 'specflow-linked-bootstrap-')));
    roots.push(linked);
    git(primary, 'worktree', 'add', '-q', '--detach', linked);
    await expect(bootstrapProjectHome(linked)).rejects.toMatchObject({
      code: 'PROJECT_HOME_INVALID',
    });
    await expect(
      readFile(join(primary, PROJECT_HOME_MARKER_RELATIVE_PATH), 'utf8'),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects a new Git repository at the same path without adopting prior Project Home state', async () => {
    const primary = await fixture();
    const engine = await bootstrapProjectHome(primary);
    const registryPath = workspaceRegistryPath(engine.context);
    const previousRegistry = await readFile(registryPath, 'utf8');
    const previousMarker = await readFile(join(primary, PROJECT_HOME_MARKER_RELATIVE_PATH), 'utf8');

    // Re-init a physically new repository, keeping .nevo/local intact and
    // preserving the exact path of the old Git common-dir.
    await rename(join(primary, '.git'), join(primary, '.git.previous'));
    git(primary, 'init', '-q');

    await expect(openSpecFlowEngine({ cwd: primary })).rejects.toMatchObject({
      code: 'PROJECT_HOME_MISMATCH',
    });
    // A cached Engine context must not continue reading/writing old state.
    await expect(readWorkspaceRegistry(engine.context)).rejects.toMatchObject({
      code: 'PROJECT_HOME_MISMATCH',
    });
    expect(await readFile(registryPath, 'utf8')).toBe(previousRegistry);
    expect(await readFile(join(primary, PROJECT_HOME_MARKER_RELATIVE_PATH), 'utf8')).toBe(
      previousMarker,
    );
  });

  it('rejects CLI init from linked checkout before entering wizard or writing any config', async () => {
    const primary = await fixture();
    const linked = await realpath(await mkdtemp(join(tmpdir(), 'specflow-linked-init-Ż ')));
    roots.push(linked);
    git(primary, 'worktree', 'add', '-q', '--detach', linked);
    await rm(join(linked, '.nevo/config.yaml'));

    const ignoredBefore = await readFile(join(linked, '.gitignore'), 'utf8');
    let wizardCalls = 0;
    const ui = new Proxy({} as RuntimeSetupUi, {
      get() {
        wizardCalls++;
        throw new Error('Init wizard must not start in linked checkout.');
      },
    });
    const program = createProgram({
      cwd: linked,
      initUi: ui,
      stdout: () => undefined,
      stderr: () => undefined,
    });

    await expect(program.parseAsync(['node', 'nevo-specflow', 'init'])).rejects.toMatchObject({
      code: 'PROJECT_HOME_INVALID',
    });
    expect(wizardCalls).toBe(0);
    expect(await readFile(join(linked, '.gitignore'), 'utf8')).toBe(ignoredBefore);
    await expect(readFile(join(linked, '.nevo/config.yaml'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(readFile(join(linked, '.nevo/local/config.yaml'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('rejects unprotected local state before publishing any marker or registry', async () => {
    const primary = await fixture();
    await writeFile(join(primary, '.gitignore'), 'node_modules/\n');
    await expect(bootstrapProjectHome(primary)).rejects.toMatchObject({
      code: 'PROJECT_HOME_INVALID',
    });
    await expect(
      readFile(join(primary, PROJECT_HOME_MARKER_RELATIVE_PATH), 'utf8'),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });
});

async function bootstrapFailureProof(primary: string) {
  // A read-only Engine open must not change previously bootstrapped identity.
  const { openSpecFlowEngine } = await import('@nevo/specflow-engine');
  return openSpecFlowEngine({ cwd: primary });
}
