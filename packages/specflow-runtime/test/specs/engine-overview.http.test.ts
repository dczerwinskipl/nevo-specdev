import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  addWorkspace,
  bindSpecToWorkspace,
  bootstrapProjectHome,
  createSpecificationFromRequest,
  provisionLinkedWorkspaceIdentity,
  updateWorkspaceRegistry,
} from '@nevo/specflow-engine';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  ArchiveSpecsOverview,
  CurrentSpecsOverview,
} from '@nevo/specflow-contracts/specs/overview';

import { createEngineSpecsReadRepository } from '../../src/features/specs/read/engine-repository';
import { InMemoryAuthenticationStore } from '../../src/features/auth/authentication/store/in-memory-store';
import { authCookieNames } from '../../src/features/auth/authentication/http/cookies';
import { createRuntimeApp } from '../../src/server/app';
import { passwordConfig } from '../auth/support/config';

function trustedLocalConfig() {
  const config = passwordConfig();
  return { ...config, authentication: { ...config.authentication, mode: 'none' as const } };
}

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', args, { cwd, windowsHide: true });
}

async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'specflow-read-Żółć ')));
  roots.push(root);
  git(root, 'init', '-q');
  await mkdir(join(root, '.nevo'));
  await writeFile(join(root, '.gitignore'), '.nevo/local/\n');
  await writeFile(join(root, '.nevo/config.yaml'), 'runtime: {}\ngit:\n  enabled: false\n');
  git(root, 'add', '.gitignore', '.nevo/config.yaml');
  git(
    root,
    '-c',
    'user.name=SpecFlow Test',
    '-c',
    'user.email=specflow@example.invalid',
    'commit',
    '-qm',
    'initial',
  );
  return { root, engine: await bootstrapProjectHome(root) };
}

describe('E2.T06 — production Engine-backed specification reads', () => {
  it('returns unavailable instead of sample data when no Engine or repository was configured', async () => {
    const app = await createRuntimeApp(trustedLocalConfig());
    try {
      for (const collection of ['current', 'archive']) {
        const result = await app.inject('/api/specs/overview?collection=' + collection);
        expect(result.statusCode).toBe(503);
        expect(result.headers['cache-control']).toBe('no-store');
        expect(result.json()).toMatchObject({ code: 'ENGINE_UNAVAILABLE' });
        expect(result.body).not.toContain('sample');
      }
    } finally {
      await app.close();
    }
  });

  it('reads live canonical manifests, revisions, archive and document/task ports', async () => {
    const { root, engine } = await fixture();
    const app = await createRuntimeApp(trustedLocalConfig(), { specs: { engine } });
    const reads = createEngineSpecsReadRepository(engine);
    try {
      const empty = await app.inject('/api/specs/overview');
      expect(empty.statusCode, empty.body).toBe(200);
      expect(empty.json<CurrentSpecsOverview>().items).toEqual([]);

      const created = await createSpecificationFromRequest(engine, {
        operationId: randomUUID(),
        title: 'Actual canonical Spec',
        target: { kind: 'existing', workspaceId: engine.workspace.workspaceId },
      });
      const current = await app.inject('/api/specs/overview');
      expect(current.statusCode, current.body).toBe(200);
      const value = current.json<CurrentSpecsOverview>();
      expect(value.items).toHaveLength(1);
      expect(value.items[0]).toMatchObject({
        id: created.specId,
        title: 'Actual canonical Spec',
        progress: null,
        classification: { section: 'unknown' },
        signals: null,
        currentExecutions: null,
      });
      expect(value.revision).not.toBe(empty.json<CurrentSpecsOverview>().revision);

      const workspace = await reads.readWorkspace(created.specId);
      expect(workspace).toMatchObject({
        status: 'available',
        value: { workspaceId: engine.workspace.workspaceId, workspaceRoot: root },
      });
      const manifest = await reads.readDocument(created.specId, 'manifest');
      expect(manifest.status).toBe('available');
      if (manifest.status !== 'available') throw new Error('Manifest must exist.');
      expect(manifest.value.content).toContain(created.specId);
      expect(await reads.readTasks(created.specId)).toEqual({ status: 'available', value: [] });

      const manifestPath = join(root, created.relativeManifestPath);
      await writeFile(
        manifestPath,
        (await readFile(manifestPath, 'utf8')).replace(
          'title: Actual canonical Spec',
          'title: Updated canonical Spec',
        ),
      );
      const updated = await app.inject('/api/specs/overview');
      expect(updated.statusCode, updated.body).toBe(200);
      expect(updated.json<CurrentSpecsOverview>().items[0]?.title).toBe('Updated canonical Spec');
      expect(updated.json<CurrentSpecsOverview>().revision).not.toBe(value.revision);

      // A populated non-draft manifest is NOT evidence of verified execution progress.
      await writeFile(
        manifestPath,
        (await readFile(manifestPath, 'utf8'))
          .replace('status: draft', 'status: impl-verified')
          .replace('tasks: []', 'tasks:\n  - id: TASK-01\n    status: done'),
      );
      const populated = await app.inject('/api/specs/overview');
      expect(populated.statusCode, populated.body).toBe(200);
      expect(populated.json<CurrentSpecsOverview>().items[0]).toMatchObject({
        progress: null,
        classification: { section: 'unknown' },
        signals: null,
        currentExecutions: null,
      });

      await mkdir(join(root, 'specs/archive'), { recursive: true });
      await rename(
        join(root, 'specs/active', created.slug),
        join(root, 'specs/archive', created.slug),
      );
      const archived = await app.inject('/api/specs/overview?collection=archive');
      expect(archived.statusCode, archived.body).toBe(200);
      expect(archived.json<ArchiveSpecsOverview>().items[0]?.id).toBe(created.specId);
      const nowCurrent = await app.inject('/api/specs/overview');
      expect(nowCurrent.json<CurrentSpecsOverview>().items).toEqual([]);
      expect((await reads.readDocument(created.specId, 'overview')).status).toBe('available');
    } finally {
      await app.close();
    }
  }, 45000);

  it('does not hide unknown canonical Specs when project settings list legacy sections', async () => {
    const { engine } = await fixture();
    const created = await createSpecificationFromRequest(engine, {
      operationId: randomUUID(),
      title: 'Legacy section config must not hide me',
      target: { kind: 'existing', workspaceId: engine.workspace.workspaceId },
    });
    const config = trustedLocalConfig();
    const app = await createRuntimeApp(
      {
        ...config,
        specs: { overview: { current: { sections: ['draft', 'ready'] } } },
      },
      { specs: { engine } },
    );
    try {
      const response = await app.inject('/api/specs/overview');
      expect(response.statusCode, response.body).toBe(200);
      expect(response.json<CurrentSpecsOverview>().sections).toEqual([
        'draft',
        'ready',
        'unknown',
      ]);
      expect(response.json<CurrentSpecsOverview>().items.map((item) => item.id)).toEqual([
        created.specId,
      ]);
    } finally {
      await app.close();
    }
  }, 45000);

  it('filters ungranted unavailable sources before building a user-scoped Overview', async () => {
    const { engine } = await fixture();
    const visible = await createSpecificationFromRequest(engine, {
      operationId: randomUUID(),
      title: 'Granted canonical Spec',
      target: { kind: 'existing', workspaceId: engine.workspace.workspaceId },
    });
    await updateWorkspaceRegistry(engine.context, (registry) =>
      bindSpecToWorkspace(registry, randomUUID(), engine.workspace.workspaceId),
    );

    const config = passwordConfig();
    const store = new InMemoryAuthenticationStore();
    const session = store.createSession({
      userId: 'demo-user',
      authenticatedWith: { kind: 'password' },
    });
    const app = await createRuntimeApp(
      {
        ...config,
        authorization: {
          assignments: [{ userId: 'demo-user', role: 'viewer', scope: { specId: visible.specId } }],
        },
      },
      { auth: { store }, specs: { engine } },
    );
    try {
      expect((await app.inject('/api/specs/overview')).statusCode).toBe(401);
      const response = await app.inject({
        url: '/api/specs/overview',
        headers: {
          cookie: authCookieNames(config.server.port).session + '=' + session,
        },
      });
      expect(response.statusCode, response.body).toBe(200);
      expect(response.json<CurrentSpecsOverview>().items.map((item) => item.id)).toEqual([
        visible.specId,
      ]);
    } finally {
      await app.close();
    }
  }, 45000);

  it('distinguishes genuinely absent Spec from a registered missing canonical manifest', async () => {
    const { engine } = await fixture();
    const missingSpecId = randomUUID();
    const reads = createEngineSpecsReadRepository(engine);
    await expect(reads.readWorkspace(randomUUID())).rejects.toMatchObject({
      code: 'SPEC_NOT_FOUND',
    });
    await updateWorkspaceRegistry(engine.context, (registry) =>
      bindSpecToWorkspace(registry, missingSpecId, engine.workspace.workspaceId),
    );
    expect(await reads.readWorkspace(missingSpecId)).toEqual({ status: 'manifest_missing' });
    const app = await createRuntimeApp(trustedLocalConfig(), { specs: { engine } });
    try {
      const response = await app.inject('/api/specs/overview');
      expect(response.statusCode, response.body).toBe(503);
      expect(response.json()).toMatchObject({ code: 'SPEC_MANIFEST_MISSING' });
      expect(response.headers['cache-control']).toBe('no-store');
    } finally {
      await app.close();
    }
  }, 30000);

  it('does not silently remove unavailable explicitly bound Specs or fall back to primary', async () => {
    const { root, engine } = await fixture();
    const linked = await realpath(await mkdtemp(join(tmpdir(), 'specflow-read-linked-Ż ')));
    roots.push(linked);
    git(root, 'worktree', 'add', '-q', '-b', 'test/read-linked', linked, 'HEAD');
    const workspace = await provisionLinkedWorkspaceIdentity(
      engine.context,
      linked,
      randomUUID(),
      true,
    );
    const specId = randomUUID();
    await updateWorkspaceRegistry(engine.context, (registry) =>
      bindSpecToWorkspace(addWorkspace(registry, workspace), specId, workspace.workspaceId),
    );
    git(root, 'worktree', 'remove', '--force', linked);
    const reads = createEngineSpecsReadRepository(engine);
    expect(await reads.readWorkspace(specId)).toMatchObject({
      status: 'workspace_unavailable',
    });
    const app = await createRuntimeApp(trustedLocalConfig(), { specs: { engine } });
    try {
      const response = await app.inject('/api/specs/overview');
      expect(response.statusCode, response.body).toBe(503);
      expect(response.json()).toMatchObject({ code: 'SPEC_WORKSPACE_UNAVAILABLE' });
    } finally {
      await app.close();
    }
  }, 30000);
});
