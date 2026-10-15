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
import type { ArchiveSpecsOverview, CurrentSpecsOverview } from '@nevo/specflow-contracts/specs/overview';

import { createEngineSpecsReadRepository } from '../../src/features/specs/read/engine-repository';
import { createRuntimeApp } from '../../src/server/app';
import { noAuthConfig } from '../auth/support/config';

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
    const app = await createRuntimeApp(noAuthConfig());
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
    const app = await createRuntimeApp(noAuthConfig(), { specs: { engine } });
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
        progress: { completed: 0, total: 0 },
        classification: { section: 'draft' },
        signals: [],
        currentExecutions: [],
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
    const app = await createRuntimeApp(noAuthConfig(), { specs: { engine } });
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
    const app = await createRuntimeApp(noAuthConfig(), { specs: { engine } });
    try {
      const response = await app.inject('/api/specs/overview');
      expect(response.statusCode, response.body).toBe(503);
      expect(response.json()).toMatchObject({ code: 'SPEC_WORKSPACE_UNAVAILABLE' });
    } finally {
      await app.close();
    }
  }, 30000);
});
