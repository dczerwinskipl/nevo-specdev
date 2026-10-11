import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  PROJECT_HOME_MARKER_RELATIVE_PATH,
  WorkspaceRegistryError,
  addWorkspace,
  bindSpecToWorkspace,
  initialWorkspaceRegistry,
  inspectRegisteredWorkspace,
  readWorkspaceRegistry,
  registerInitialPrimary,
  resolveProjectHome,
  resolveSpecWorkspaceId,
  validateWorkspaceRegistry,
  verifyWorkspaceRoot,
  workspaceRegistryPath,
} from '../src/index';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'specflow-registry-Ż ')));
  roots.push(root);
  execFileSync('git', ['init', '-q'], { cwd: root });
  await mkdir(join(root, '.nevo/local/state'), { recursive: true });
  await writeFile(join(root, '.gitignore'), '.nevo/local/\n');
  await writeFile(join(root, '.nevo/config.yaml'), 'runtime: {}\n');
  const projectId = randomUUID();
  const commonDir = await realpath(resolve(root, '.git'));
  await writeFile(
    join(root, PROJECT_HOME_MARKER_RELATIVE_PATH),
    JSON.stringify({
      version: 1,
      projectId,
      homeRoot: root,
      gitCommonDir: commonDir,
      registryBootstrap: 'fresh',
    }),
  );
  const context = await resolveProjectHome({ cwd: root });
  const registry = registerInitialPrimary(initialWorkspaceRegistry(context), context);
  return { root, context, registry };
}

function assertError(action: () => unknown, code: WorkspaceRegistryError['code']): void {
  try {
    action();
    expect.fail('Expected registry validation failure');
  } catch (error) {
    expect(error).toBeInstanceOf(WorkspaceRegistryError);
    expect((error as WorkspaceRegistryError).code).toBe(code);
  }
}

describe('Engine workspace registry model (E1.T04)', () => {
  it('keeps a local project identity, stable primary and revisioned spec binding', async () => {
    const { context, registry } = await fixture();
    const secondary = join(context.project.homeRoot, '..', 'missing-linked');
    const linked = addWorkspace(registry, {
      workspaceId: randomUUID(),
      kind: 'linked',
      root: resolve(secondary),
      managed: true,
      instanceId: randomUUID(),
    });
    const specId = randomUUID();
    const bound = bindSpecToWorkspace(linked, specId, linked.workspaces[1]!.workspaceId);
    const next = validateWorkspaceRegistry({ ...bound, revision: 1 }, context);
    expect(next.specBindings[0]?.generation).toBe(1);
    expect(resolveSpecWorkspaceId(next, specId)).toBe(linked.workspaces[1]!.workspaceId);
    expect(resolveSpecWorkspaceId(next, randomUUID())).toBe(next.primaryWorkspaceId);
    expect(next.workspaces[0]?.root).toBe(context.project.homeRoot);
  });

  it('distinguishes absent registry from corrupt, unknown-version and duplicate state', async () => {
    const { context, registry } = await fixture();
    await expect(readWorkspaceRegistry(context)).rejects.toMatchObject({
      code: 'REGISTRY_NOT_FOUND',
    });
    await writeFile(workspaceRegistryPath(context), '{broken');
    await expect(readWorkspaceRegistry(context)).rejects.toMatchObject({
      code: 'REGISTRY_CORRUPT',
    });
    assertError(
      () => validateWorkspaceRegistry({ ...registry, version: 10 }, context),
      'REGISTRY_UNSUPPORTED_VERSION',
    );
    assertError(
      () =>
        validateWorkspaceRegistry(
          {
            ...registry,
            workspaces: [...registry.workspaces, registry.workspaces[0]],
          },
          context,
        ),
      'REGISTRY_CORRUPT',
    );
    assertError(
      () => validateWorkspaceRegistry({ ...registry, projectId: randomUUID() }, context),
      'REGISTRY_PROJECT_MISMATCH',
    );
    assertError(
      () =>
        validateWorkspaceRegistry(
          {
            ...registry,
            specBindings: [{ specId: 'a', workspaceId: 'not-registered', generation: 0 }],
          },
          context,
        ),
      'REGISTRY_CORRUPT',
    );
  });

  it('retains a missing linked workspace as unavailable with no primary fallback', async () => {
    const { context, registry } = await fixture();
    const workspaceId = randomUUID();
    const linked = addWorkspace(registry, {
      workspaceId,
      kind: 'linked',
      root: resolve(join(context.project.homeRoot, '..', 'deleted-worktree')),
      managed: true,
      instanceId: randomUUID(),
    });
    const bound = bindSpecToWorkspace(linked, 'spec-1', workspaceId);
    expect(resolveSpecWorkspaceId(bound, 'spec-1')).toBe(workspaceId);
    expect(await inspectRegisteredWorkspace(context, bound, workspaceId)).toMatchObject({
      status: 'unavailable',
      workspace: { workspaceId },
    });
    await expect(
      verifyWorkspaceRoot(context, join(context.project.homeRoot, 'other')),
    ).rejects.toMatchObject({
      code: 'REGISTRY_WORKSPACE_UNAVAILABLE',
    });
  });

  it('rejects an independent local clone with an identical remote URL as a workspace', async () => {
    const { root, context } = await fixture();
    const other = await realpath(await mkdtemp(join(tmpdir(), 'specflow-foreign-')));
    roots.push(other);
    execFileSync('git', ['init', '-q'], { cwd: other });
    execFileSync('git', ['remote', 'add', 'origin', 'https://example.invalid/shared.git'], {
      cwd: other,
    });
    execFileSync('git', ['remote', 'add', 'origin', 'https://example.invalid/shared.git'], {
      cwd: root,
    });
    await expect(verifyWorkspaceRoot(context, other)).rejects.toMatchObject({
      code: 'REGISTRY_WORKSPACE_MISMATCH',
    });
  });

  it('rejects conflicting workspace roots and unauthorized implicit rebinding', async () => {
    const { registry } = await fixture();
    const secondId = randomUUID();
    const second = addWorkspace(registry, {
      workspaceId: secondId,
      kind: 'linked',
      root: join(registry.workspaces[0]!.root, 'another'),
      managed: true,
      instanceId: randomUUID(),
    });
    assertError(
      () =>
        addWorkspace(second, {
          workspaceId: randomUUID(),
          kind: 'linked',
          root: second.workspaces[1]!.root,
          managed: false,
        }),
      'REGISTRY_CONFLICT',
    );
    const bound = bindSpecToWorkspace(second, 'spec-2', secondId);
    assertError(
      () => bindSpecToWorkspace(bound, 'spec-2', registry.primaryWorkspaceId),
      'REGISTRY_CONFLICT',
    );
  });
});
