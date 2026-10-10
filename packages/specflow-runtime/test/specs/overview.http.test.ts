import { describe, expect, it, vi } from 'vitest';
import type {
  ArchiveSpecsOverview,
  CurrentSpecsOverview,
  SpecsOverview,
} from '@nevo/specflow-contracts/specs/overview';

import { InMemoryAuthenticationStore } from '../../src/features/auth/authentication/store/in-memory-store';
import { authCookieNames } from '../../src/features/auth/authentication/http/cookies';
import { createRuntimeApp } from '../../src/server/app';
import { cookieValue } from '../auth/support/http';
import { passwordConfig } from '../auth/support/config';

describe('Specs overview HTTP integration', () => {
  it('retains trusted-local disabled access semantics', async () => {
    const config = passwordConfig();
    const app = await createRuntimeApp(
      {
        ...config,
        authentication: { ...config.authentication, mode: 'none' },
      },
      { specs: { mode: 'demo' } },
    );

    try {
      const response = await app.inject('/api/specs/overview');
      expect(response.statusCode).toBe(200);

      const overview = response.json<CurrentSpecsOverview>();
      expect(overview.collection).toBe('current');
      expect(overview.items).toHaveLength(6);
      expect(overview.sections).toEqual(['requires-attention', 'active', 'ready', 'draft']);
    } finally {
      await app.close();
    }
  });

  it('uses real password login and revokes list access on logout', async () => {
    const config = passwordConfig();
    const app = await createRuntimeApp(
      {
        ...config,
        authorization: {
          assignments: [{ userId: 'demo-user', role: 'viewer', scope: {} }],
        },
      },
      { specs: { mode: 'demo' } },
    );

    try {
      const anonymous = await app.inject('/api/specs/overview');
      expect(anonymous.statusCode).toBe(401);
      expect(anonymous.json()).toEqual({ error: 'authentication_required' });

      const login = await app.inject({
        method: 'POST',
        url: '/api/auth/password/login',
        payload: { username: 'demo', password: 'correct horse battery staple' },
      });
      expect(login.statusCode).toBe(200);

      const name = authCookieNames(config.server.port).session;
      const cookie = `${name}=${cookieValue(login.headers['set-cookie'], name)}`;
      const headers = { cookie };

      const current = await app.inject({
        url: '/api/specs/overview?collection=current',
        headers,
      });
      expect(current.statusCode).toBe(200);
      expect(current.headers['cache-control']).toBe('no-store');

      const currentBody = current.json<CurrentSpecsOverview>();
      expect(currentBody.collection).toBe('current');
      expect(currentBody.items).toHaveLength(6);
      expect(currentBody).not.toHaveProperty('sample');

      const archive = await app.inject({
        url: '/api/specs/overview?collection=archive',
        headers,
      });
      expect(archive.statusCode).toBe(200);

      const archiveBody = archive.json<ArchiveSpecsOverview>();
      expect(archiveBody.collection).toBe('archive');
      expect(archiveBody.items[0]?.id).toBe('archived-shell');
      expect(archiveBody).not.toHaveProperty('sections');
      expect(archiveBody).not.toHaveProperty('sample');

      const historical = archiveBody.items[0];
      expect(historical).toHaveProperty('completedAt');
      for (const field of ['classification', 'signals', 'currentExecutions']) {
        expect(historical).not.toHaveProperty(field);
      }

      await app.inject({ method: 'POST', url: '/api/auth/logout', headers });
      expect((await app.inject({ url: '/api/specs/overview', headers })).statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it('filters by server-owned per-item scope', async () => {
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
          assignments: [
            {
              userId: 'demo-user',
              role: 'viewer',
              scope: { specId: 'security' },
            },
          ],
        },
      },
      { auth: { store }, specs: { mode: 'demo' } },
    );
    const headers = { cookie: `${authCookieNames(config.server.port).session}=${session}` };

    try {
      const response = await app.inject({ url: '/api/specs/overview', headers });
      expect(response.statusCode).toBe(200);
      expect(response.json<CurrentSpecsOverview>().items.map((item) => item.id)).toEqual([
        'security',
      ]);

      expect(
        (await app.inject({ url: '/api/specs/overview?unexpected=other', headers })).statusCode,
      ).toBe(400);
      expect(
        (await app.inject({ url: '/api/specs/overview?collection=wrong', headers })).statusCode,
      ).toBe(400);
    } finally {
      await app.close();
    }
  });

  it('returns 403 when the subject has no spec.view grant in any scope', async () => {
    const config = passwordConfig();
    const store = new InMemoryAuthenticationStore();
    const session = store.createSession({
      userId: 'demo-user',
      authenticatedWith: { kind: 'password' },
    });
    const readCurrent = vi.fn(() => Promise.reject(new Error('repository must not be read')));
    const readArchive = vi.fn(() => Promise.reject(new Error('repository must not be read')));
    const app = await createRuntimeApp(config, {
      auth: { store },
      specs: { overviewRepository: { readCurrent, readArchive } },
    });

    try {
      const response = await app.inject({
        url: '/api/specs/overview',
        headers: {
          cookie: `${authCookieNames(config.server.port).session}=${session}`,
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({ error: 'forbidden' });
      expect(readCurrent).not.toHaveBeenCalled();
      expect(readArchive).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it.each([
    ['current', 'archived-shell'],
    ['archive', 'security'],
  ] as const)(
    'returns empty 200 when spec.view exists, but no visible row is in the %s collection',
    async (collection, grantedSpecId) => {
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
            assignments: [
              {
                userId: 'demo-user',
                role: 'viewer',
                scope: { specId: grantedSpecId },
              },
            ],
          },
        },
        { auth: { store }, specs: { mode: 'demo' } },
      );

      try {
        const response = await app.inject({
          url: `/api/specs/overview?collection=${collection}`,
          headers: {
            cookie: `${authCookieNames(config.server.port).session}=${session}`,
          },
        });

        expect(response.statusCode).toBe(200);
        expect(response.json<SpecsOverview>().items).toEqual([]);
      } finally {
        await app.close();
      }
    },
  );
});
