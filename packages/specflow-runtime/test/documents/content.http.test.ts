import { describe, expect, it } from 'vitest';
import { createRuntimeApp } from '../../src/server/app';
import { passwordConfig } from '../auth/support/config';
describe('Documents versioned content HTTP', () => {
  it('keeps exact v1 distinct from latest v2 and never substitutes a missing historical body', async () => {
    const config = passwordConfig();
    const app = await createRuntimeApp(
      { ...config, authentication: { ...config.authentication, mode: 'none' } },
      {
        documents: {
          source: {
            read: (specId, id, revision) =>
              Promise.resolve(
                id !== 'report'
                  ? { kind: 'not_found' }
                  : revision && revision !== 'v1' && revision !== 'v2'
                    ? { kind: 'revision_unavailable' }
                    : {
                        kind: 'ok',
                        document: {
                          specId,
                          id,
                          title: 'Report',
                          content: revision === 'v1' ? 'Historical content' : 'Current content',
                          revision: revision ?? 'v2',
                        },
                      },
              ),
          },
        },
      },
    );
    try {
      const url = '/api/specs/admission/documents/report';
      expect((await app.inject(url)).json()).toMatchObject({
        content: 'Current content',
        revision: 'v2',
      });
      const old = await app.inject(url + '?revision=v1');
      expect(old.statusCode).toBe(200);
      expect(old.headers['cache-control']).toBe('no-store');
      expect(old.json()).toMatchObject({ content: 'Historical content', revision: 'v1' });
      const missing = await app.inject(url + '?revision=v0');
      expect(missing.statusCode).toBe(409);
      expect(missing.json()).toEqual({ error: 'document_revision_unavailable' });
      expect((await app.inject(url + '?revision=')).statusCode).toBe(400);
      expect((await app.inject(url + '?other=1')).statusCode).toBe(400);
      expect(
        (await app.inject('/api/specs/admission/documents/missing?revision=v1')).statusCode,
      ).toBe(404);
    } finally {
      await app.close();
    }
  });
  it('rejects an adapter that returns latest for an exact-version read before serializing content', async () => {
    const config = passwordConfig();
    const app = await createRuntimeApp(
      { ...config, authentication: { ...config.authentication, mode: 'none' } },
      {
        documents: {
          source: {
            read: (specId, id) =>
              Promise.resolve({
                kind: 'ok',
                document: {
                  specId,
                  id,
                  title: 'Report',
                  revision: 'v2',
                  content: 'Do not expose v2 as v1',
                },
              }),
          },
        },
      },
    );
    try {
      const response = await app.inject('/api/specs/admission/documents/report?revision=v1');
      expect(response.statusCode).toBe(409);
      expect(response.body).not.toContain('Do not expose');
    } finally {
      await app.close();
    }
  });
});
