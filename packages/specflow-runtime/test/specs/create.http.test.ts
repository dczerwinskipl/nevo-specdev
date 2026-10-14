import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  ProjectControlLockError,
  bootstrapProjectHome,
  discoverSpecifications,
  workspaceRegistryPath,
} from '@nevo/specflow-engine';
import { afterEach, describe, expect, it } from 'vitest';

import { InMemoryAuthenticationStore } from '../../src/features/auth/authentication/store/in-memory-store';
import { authCookieNames } from '../../src/features/auth/authentication/http/cookies';
import { createRuntimeApp } from '../../src/server/app';
import { passwordConfig } from '../auth/support/config';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', args, { cwd });
}

async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'specflow-http-create-Ż ')));
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

function authenticatedStore() {
  const store = new InMemoryAuthenticationStore();
  const session = store.createSession({
    userId: 'demo-user',
    authenticatedWith: { kind: 'password' },
  });
  const cookie = authCookieNames(passwordConfig().server.port).session;
  return { store, headers: { cookie: cookie + '=' + session } };
}

describe('E2.T05 — authorized HTTP Spec create adapter', () => {
  it('H02: denies anonymous and viewer before any journal/registry/manifest write', async () => {
    const { engine } = await fixture();
    const auth = authenticatedStore();
    const config = passwordConfig();
    const app = await createRuntimeApp(
      {
        ...config,
        authorization: { assignments: [{ userId: 'demo-user', role: 'viewer', scope: {} }] },
      },
      { auth: { store: auth.store }, specs: { engine } },
    );
    const path = workspaceRegistryPath(engine.context);
    const registryBefore = await readFile(path, 'utf8');
    try {
      const anonymous = await app.inject({
        method: 'POST',
        url: '/api/specs',
        payload: { title: 'Unauthorized' },
      });
      expect(anonymous.statusCode).toBe(401);
      const denied = await app.inject({
        method: 'POST',
        url: '/api/specs',
        headers: auth.headers,
        payload: { title: 'Unauthorized' },
      });
      expect(denied.statusCode).toBe(403);
      expect(await readFile(path, 'utf8')).toBe(registryBefore);
      expect(await discoverSpecifications(engine)).toEqual([]);
    } finally {
      await app.close();
    }
  });

  it('does not accept a spec-scoped developer grant as project-level creation rights', async () => {
    const { engine } = await fixture();
    const auth = authenticatedStore();
    const app = await createRuntimeApp(
      {
        ...passwordConfig(),
        authorization: {
          assignments: [
            { userId: 'demo-user', role: 'developer', scope: { specId: randomUUID() } },
          ],
        },
      },
      { auth: { store: auth.store }, specs: { engine } },
    );
    try {
      expect(
        (
          await app.inject({
            method: 'POST',
            url: '/api/specs',
            headers: auth.headers,
            payload: { title: 'Scoped developer cannot create project Spec' },
          })
        ).statusCode,
      ).toBe(403);
      expect(await discoverSpecifications(engine)).toEqual([]);
    } finally {
      await app.close();
    }
  });

  it('H06: creates via real Engine then retries without duplicate registry update', async () => {
    const { root, engine } = await fixture();
    const auth = authenticatedStore();
    const app = await createRuntimeApp(
      {
        ...passwordConfig(),
        authorization: { assignments: [{ userId: 'demo-user', role: 'developer', scope: {} }] },
      },
      { auth: { store: auth.store }, specs: { engine } },
    );
    try {
      const operationId = randomUUID();
      const payload = { title: 'HTTP canonical Spec', operationId };
      const first = await app.inject({
        method: 'POST',
        url: '/api/specs',
        headers: auth.headers,
        payload,
      });
      expect(first.statusCode, first.body).toBe(201);
      expect(first.headers['cache-control']).toBe('no-store');
      const created = first.json<{
        specId: string;
        workspaceId: string;
        relativeManifestPath: string;
      }>();
      expect(created.workspaceId).toBe(engine.workspace.workspaceId);
      expect(await readFile(join(root, created.relativeManifestPath), 'utf8')).toContain(
        created.specId,
      );
      const registryBefore = await readFile(workspaceRegistryPath(engine.context), 'utf8');
      const second = await app.inject({
        method: 'POST',
        url: '/api/specs',
        headers: auth.headers,
        payload,
      });
      expect(second.statusCode, second.body).toBe(201);
      expect(second.json()).toEqual(first.json());
      expect(await readFile(workspaceRegistryPath(engine.context), 'utf8')).toBe(registryBefore);
      expect((await discoverSpecifications(engine)).map((item) => item.specId)).toEqual([
        created.specId,
      ]);
    } finally {
      await app.close();
    }
  });

  it('rejects unexpected request keys and invalid title without persistence', async () => {
    const { engine } = await fixture();
    const app = await createRuntimeApp(
      { ...passwordConfig(), authentication: { ...passwordConfig().authentication, mode: 'none' } },
      { specs: { engine } },
    );
    try {
      const before = await readFile(workspaceRegistryPath(engine.context), 'utf8');
      for (const payload of [{ title: '' }, { title: 'Valid', workspaceRoot: '/tmp/foreign' }]) {
        const response = await app.inject({ method: 'POST', url: '/api/specs', payload });
        expect(response.statusCode, response.body).toBe(400);
      }
      expect(await readFile(workspaceRegistryPath(engine.context), 'utf8')).toBe(before);
    } finally {
      await app.close();
    }
  });

  it('returns a typed 503 for a busy Project Home lock during default target selection', async () => {
    const { engine } = await fixture();
    const failingEngine = {
      ...engine,
      readRegistry: () =>
        Promise.reject(
          new ProjectControlLockError('CONTROL_LOCK_BUSY', 'Another writer owns the lock.'),
        ),
    };
    const app = await createRuntimeApp(
      {
        ...passwordConfig(),
        authentication: { ...passwordConfig().authentication, mode: 'none' },
      },
      { specs: { engine: failingEngine } },
    );
    const registryBefore = await readFile(workspaceRegistryPath(engine.context), 'utf8');
    try {
      const result = await app.inject({
        method: 'POST',
        url: '/api/specs',
        payload: { title: 'Must not persist while Engine is unavailable' },
      });
      expect(result.statusCode, result.body).toBe(503);
      expect(result.json()).toMatchObject({ code: 'CONTROL_LOCK_BUSY' });
      expect(await readFile(workspaceRegistryPath(engine.context), 'utf8')).toBe(registryBefore);
      expect(await discoverSpecifications(engine)).toEqual([]);
    } finally {
      await app.close();
    }
  });

  it('keeps unconfigured/demo Runtime create unavailable instead of mutating the project', async () => {
    const app = await createRuntimeApp({
      ...passwordConfig(),
      authentication: { ...passwordConfig().authentication, mode: 'none' },
    });
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/specs',
        payload: { title: 'Should never be created' },
      });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({ code: 'ENGINE_UNAVAILABLE' });
    } finally {
      await app.close();
    }
  });
});
