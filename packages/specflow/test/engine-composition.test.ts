import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  PROJECT_HOME_MARKER_RELATIVE_PATH,
  GIT_INSTANCE_SENTINEL_FILE,
  WORKSPACE_IDENTITY_RELATIVE_PATH,
  addWorkspace,
  initializeWorkspaceRegistry,
  openSpecFlowEngine,
  provisionLinkedWorkspaceIdentity,
  readWorkspaceRegistry,
  resolveProjectHome,
  updateWorkspaceRegistry,
  workspaceRegistryPath,
} from '@nevo/specflow-engine';
import type { RuntimeStartOptions, RuntimeWebApp } from '@nevo/specflow-runtime';
import { afterEach, describe, expect, it } from 'vitest';

import { createProgram } from '../src/program';
import { startProjectRuntime } from '../src/runtime/start-project-runtime';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

function git(root: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

async function tempRoot(): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'specflow-compose-Ż ')));
  roots.push(root);
  return root;
}

async function fixture() {
  const primary = await tempRoot();
  git(primary, 'init', '-q');
  await mkdir(join(primary, '.nevo'), { recursive: true });
  await writeFile(join(primary, '.gitignore'), '.nevo/local/\n');
  await writeFile(join(primary, '.nevo/config.yaml'), 'runtime:\n  server:\n    port: 4318\n');
  git(primary, 'add', '.gitignore', '.nevo/config.yaml');
  git(
    primary,
    '-c',
    'user.name=SpecFlow Test',
    '-c',
    'user.email=specflow@example.invalid',
    'commit',
    '-qm',
    'bootstrap',
  );

  const linked = await tempRoot();
  git(primary, 'worktree', 'add', '-q', '-b', 'linked-config', linked);
  const projectId = randomUUID();
  const gitInstanceId = randomUUID();
  const commonDir = await realpath(resolve(primary, '.git'));
  await writeFile(
    join(commonDir, GIT_INSTANCE_SENTINEL_FILE),
    JSON.stringify({ version: 1, projectId, instanceId: gitInstanceId }),
  );
  await mkdir(join(primary, '.nevo/local/state'), { recursive: true });
  await writeFile(
    join(primary, PROJECT_HOME_MARKER_RELATIVE_PATH),
    JSON.stringify({
      version: 1,
      projectId,
      homeRoot: primary,
      gitCommonDir: commonDir,
      gitInstanceId,
      registryBootstrap: 'fresh',
    }),
  );
  await writeFile(join(primary, '.nevo/local/config.yaml'), 'runtime: {}\n');
  const context = await resolveProjectHome({ cwd: primary });
  await initializeWorkspaceRegistry(context);
  const registered = await provisionLinkedWorkspaceIdentity(context, linked, randomUUID(), true);
  await updateWorkspaceRegistry(context, (current) => addWorkspace(current, registered));

  // Simulate a branch with divergent, potentially permissive Runtime policy.
  await writeFile(
    join(linked, '.nevo/config.yaml'),
    'runtime:\n  server:\n    port: 9999\n  authentication:\n    mode: trusted-local\n',
  );
  return { primary, linked, context, registered, projectId };
}

const webApp: RuntimeWebApp = {
  indexHtml: { body: Buffer.from('<html></html>'), contentType: 'text/html' },
  assets: new Map(),
};

describe('E1.T06 CLI / Runtime Engine composition', () => {
  it('uses one offline Project Home authority from primary and linked worktree', async () => {
    const { primary, linked, registered, projectId } = await fixture();
    const fromPrimary = await openSpecFlowEngine({ cwd: primary });
    const fromLinked = await openSpecFlowEngine({ cwd: linked });
    expect(fromPrimary.context.project).toEqual(fromLinked.context.project);
    expect(fromLinked.context.project.projectId).toBe(projectId);
    expect(fromPrimary.workspace.workspaceId).not.toBe(fromLinked.workspace.workspaceId);
    expect(fromLinked.workspace.workspaceId).toBe(registered.workspaceId);
    expect(await fromLinked.readRegistry()).toEqual(await fromPrimary.readRegistry());

    const output: string[] = [];
    const program = createProgram({
      cwd: linked,
      stdout: (line) => output.push(line),
      stderr: () => undefined,
    });
    await program.parseAsync(['node', 'nevo-specflow', 'project', 'inspect', '--json']);
    const inspection = JSON.parse(output.join('')) as Record<string, string>;
    expect(inspection).toMatchObject({
      projectId,
      homeRoot: primary,
      workspaceId: registered.workspaceId,
      workspaceRoot: linked,
      projectConfigPath: join(primary, '.nevo/config.yaml'),
      localConfigPath: join(primary, '.nevo/local/config.yaml'),
    });

    const calls: RuntimeStartOptions[] = [];
    await startProjectRuntime(linked, {
      loadWebApp: () => Promise.resolve(webApp),
      start: (options) => {
        calls.push(options);
        return Promise.resolve({ address: 'ignored', close: () => Promise.resolve() });
      },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      projectRoot: primary,
      projectConfigPath: join(primary, '.nevo/config.yaml'),
      localConfigPath: join(primary, '.nevo/local/config.yaml'),
    });
    expect(calls[0]?.projectConfigPath).not.toBe(join(linked, '.nevo/config.yaml'));
    expect(await readFile(calls[0]!.projectConfigPath, 'utf8')).toContain('4318');
    expect(await readFile(join(linked, '.nevo/config.yaml'), 'utf8')).toContain('9999');
  });

  it('rejects a foreign CLI locator without creating new state', async () => {
    const { primary, linked, context } = await fixture();
    const foreign = await tempRoot();
    git(foreign, 'init', '-q');
    const before = await readFile(workspaceRegistryPath(context), 'utf8');
    const out: string[] = [];
    const program = createProgram({
      cwd: linked,
      stdout: (line) => out.push(line),
      stderr: () => undefined,
    });
    await expect(
      program.parseAsync([
        'node',
        'nevo-specflow',
        'project',
        'inspect',
        '--json',
        '--project-root',
        foreign,
      ]),
    ).rejects.toMatchObject({ code: 'PROJECT_HOME_MISMATCH' });
    expect(out).toEqual([]);
    expect(await readFile(workspaceRegistryPath(context), 'utf8')).toBe(before);
    expect(primary).not.toBe(foreign);
  });

  it('refuses unregistered linked worktrees before loading the UI or listening', async () => {
    const { primary, context } = await fixture();
    const unregistered = await tempRoot();
    git(primary, 'worktree', 'add', '-q', '-b', 'not-registered', unregistered);
    let sideEffects = 0;
    await expect(
      startProjectRuntime(unregistered, {
        loadWebApp: () => {
          sideEffects++;
          return Promise.resolve(webApp);
        },
        start: () => {
          sideEffects++;
          return Promise.resolve({ address: 'unused', close: () => Promise.resolve() });
        },
      }),
    ).rejects.toMatchObject({ code: 'REGISTRY_CONFLICT' });
    expect(sideEffects).toBe(0);
    expect((await readWorkspaceRegistry(context)).revision).toBe(1);
  });

  it('fails closed on a substituted linked identity and corrupt registry', async () => {
    const { linked, context } = await fixture();
    const marker = join(linked, WORKSPACE_IDENTITY_RELATIVE_PATH);
    const original = await readFile(marker, 'utf8');
    const engine = await openSpecFlowEngine({ cwd: linked });
    await writeFile(marker, JSON.stringify({ ...JSON.parse(original), instanceId: randomUUID() }));
    await expect(engine.readRegistry()).rejects.toMatchObject({
      code: 'REGISTRY_WORKSPACE_MISMATCH',
    });
    await expect(openSpecFlowEngine({ cwd: linked })).rejects.toMatchObject({
      code: 'REGISTRY_WORKSPACE_MISMATCH',
    });

    await writeFile(marker, original);
    await writeFile(workspaceRegistryPath(context), '{invalid');
    await expect(openSpecFlowEngine({ cwd: linked })).rejects.toMatchObject({
      code: 'REGISTRY_CORRUPT',
    });
  });
});
