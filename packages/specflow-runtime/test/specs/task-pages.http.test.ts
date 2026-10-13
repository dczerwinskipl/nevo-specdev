import { describe, expect, it } from 'vitest';
import type {
  SpecificationTaskResponse,
  TaskResourcePage,
} from '@nevo/specflow-contracts/specs/workspace';
import { createRuntimeApp } from '../../src/server/app';
import { passwordConfig } from '../auth/support/config';

describe('Task snapshot and page HTTP boundary', () => {
  it('serves demo detail, scopes pages, excludes recommendations and rejects stale tokens', async () => {
    const config = passwordConfig();
    const app = await createRuntimeApp(
      { ...config, authentication: { ...config.authentication, mode: 'none' } },
      { dataMode: 'demo' },
    );
    try {
      const response = await app.inject('/api/specs/admission/tasks/TASK-03');
      expect(response.statusCode).toBe(200);
      const snapshot = response.json<SpecificationTaskResponse>().snapshot!;
      expect(snapshot.specification.id).toBe('admission');
      const resources = snapshot.sections.resources;
      if (resources.state !== 'available') throw new Error('Demo resources required');
      const token = resources.data.page!.token;
      const page = await app.inject(
        `/api/specs/admission/tasks/TASK-03/resources?token=${encodeURIComponent(token)}&limit=5`,
      );
      expect(page.statusCode).toBe(200);
      expect(page.headers['cache-control']).toBe('no-store');
      const result = page.json<TaskResourcePage>();
      expect(result.items).toHaveLength(5);
      expect(result.items[0]!.id).toBe('document-4');
      const stale = await app.inject('/api/specs/admission/tasks/TASK-03/resources?token=expired');
      expect(stale.statusCode).toBe(409);
      const wrongScope = await app.inject(
        `/api/specs/admission/tasks/TASK-02/resources?token=${encodeURIComponent(token)}`,
      );
      expect(wrongScope.statusCode).toBe(409);
      const invalidLimit = await app.inject(
        `/api/specs/admission/tasks/TASK-03/resources?token=${encodeURIComponent(token)}&limit=51`,
      );
      expect(invalidLimit.statusCode).toBe(400);
      const doc = await app.inject('/api/specs/admission/documents/TASK-03');
      expect(doc.statusCode).toBe(200);
      expect(doc.json<{ content: string }>().content).toContain(snapshot.summary);
    } finally {
      await app.close();
    }
  });
  it('requires authentication for both lazy page routes', async () => {
    const app = await createRuntimeApp(passwordConfig(), { dataMode: 'demo' });
    try {
      for (const kind of ['resources', 'history']) {
        const result = await app.inject(
          `/api/specs/admission/tasks/TASK-03/${kind}?token=demo-task-1.admission.TASK-03`,
        );
        expect(result.statusCode).toBe(401);
      }
    } finally {
      await app.close();
    }
  });
  it('enforces Specification scope before reading detail or pages', async () => {
    const config = passwordConfig();
    const app = await createRuntimeApp(
      {
        ...config,
        authentication: { ...config.authentication, mode: 'none', localUserId: 'demo-user' },
        authorization: {
          assignments: [{ userId: 'demo-user', role: 'viewer', scope: { specId: 'other' } }],
        },
      },
      { dataMode: 'demo' },
    );
    try {
      for (const suffix of ['', '/resources?token=any', '/history?token=any'])
        expect((await app.inject(`/api/specs/admission/tasks/TASK-03${suffix}`)).statusCode).toBe(
          403,
        );
    } finally {
      await app.close();
    }
  });
  it('never falls back to demo when the project reader is absent', async () => {
    const config = passwordConfig();
    const app = await createRuntimeApp({
      ...config,
      authentication: { ...config.authentication, mode: 'none' },
    });
    try {
      const page = await app.inject(
        '/api/specs/admission/tasks/TASK-03/resources?token=demo-task-1',
      );
      expect(page.statusCode).toBe(503);
      expect(page.json()).toEqual({ error: 'specification_source_unavailable' });
      expect((await app.inject('/api/specs/admission/tasks/TASK-03')).statusCode).toBe(503);
    } finally {
      await app.close();
    }
  });
});
