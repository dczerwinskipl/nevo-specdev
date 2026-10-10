import { describe, expect, it } from 'vitest';
import type {
  SpecificationWorkspaceResponse,
  SpecificationDocumentResponse,
  SpecificationTaskResponse,
} from '@nevo/specflow-contracts/specs/workspace';
import type { CurrentSpecsOverview } from '@nevo/specflow-contracts/specs/overview';
import { InMemoryAuthenticationStore } from '../../src/features/auth/authentication/store/in-memory-store';
import { authCookieNames } from '../../src/features/auth/authentication/http/cookies';
import { createRuntimeApp } from '../../src/server/app';
import { passwordConfig } from '../auth/support/config';
import { createDemoSpecsRepositories } from '../../src/features/specs/demo/repositories';

describe('Specification Workspace Runtime HTTP integration', () => {
  it('rejects mismatched document and Task identifiers returned by the source', async () => {
    const config = passwordConfig();
    const { workspaceRepository } = createDemoSpecsRepositories();
    const app = await createRuntimeApp(
      {
        ...config,
        authentication: { ...config.authentication, mode: 'none' },
      },
      {
        specs: {
          workspaceRepository: {
            ...workspaceRepository,
            readDocument: () =>
              Promise.resolve({
                id: 'different',
                title: 'Wrong',
                content: 'Secret',
                revision: '1',
              }),
            readTask: () =>
              Promise.resolve({
                task: {
                  id: 'WRONG',
                  title: 'Wrong',
                  status: { id: 'ready', label: 'Ready', lifecycle: 'pending' },
                },
                acceptanceCriteria: [],
              }),
          },
        },
      },
    );
    try {
      const doc = await app.inject('/api/specs/admission/documents/spec');
      const task = await app.inject('/api/specs/admission/tasks/TASK-01');
      expect(doc.statusCode).toBe(500);
      expect(task.statusCode).toBe(500);
      expect(doc.body).not.toContain('Secret');
    } finally {
      await app.close();
    }
  });

  it('serves one coherent Overview, Workspace, Task, and document through actual HTTP routes', async () => {
    const config = passwordConfig();
    const app = await createRuntimeApp(
      {
        ...config,
        authentication: { ...config.authentication, mode: 'none' },
      },
      { specs: { mode: 'demo' } },
    );
    try {
      const overviewResponse = await app.inject('/api/specs/overview');
      expect(overviewResponse.statusCode).toBe(200);
      const overview = overviewResponse.json<CurrentSpecsOverview>();
      const admission = overview.items.find((item) => item.id === 'admission');
      expect(admission).toBeDefined();
      if (!admission) throw new Error('Demo admission Specification is required.');

      const response = await app.inject('/api/specs/admission/workspace');
      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      const workspace = response.json<SpecificationWorkspaceResponse>();
      expect(workspace.specification.id).toBe(admission?.id);
      expect(workspace.specification.title).toBe(admission?.title);
      const taskSection = workspace.sections.tasks;
      expect(taskSection.state).toBe('available');
      if (taskSection.state !== 'available') throw new Error('Expected demo Tasks');
      const ids = taskSection.data.groups.flatMap((group) => group.tasks.map((task) => task.id));
      expect(ids).toContain('TASK-02');
      const currentExecutions = admission?.currentExecutions ?? [];
      for (const execution of currentExecutions) {
        for (const activeId of execution.taskIds) {
          const item = taskSection.data.groups
            .flatMap((group) => group.tasks)
            .find((task) => task.id === activeId);
          expect(item?.status.lifecycle).toBe('in_progress');
        }
      }
      expect(
        taskSection.data.groups
          .flatMap((group) => group.tasks)
          .filter((task) => task.status.lifecycle === 'completed'),
      ).toHaveLength(admission.progress.completed);
      expect(taskSection.data.total).toBe(admission?.progress.total);

      const sessions = workspace.sections.sessions;
      expect(sessions.state).toBe('available');
      if (sessions.state !== 'available') throw new Error('Expected demo Sessions');
      expect(sessions.data.items.some((item) => item.id === 'sample-session-24')).toBe(true);
      expect(sessions.data.items.some((item) => item.id === 'sample-session-23')).toBe(true);

      const taskResponse = await app.inject('/api/specs/admission/tasks/TASK-02');
      expect(taskResponse.statusCode).toBe(200);
      expect(taskResponse.json<SpecificationTaskResponse>().task.id).toBe('TASK-02');

      const docResponse = await app.inject('/api/specs/admission/documents/spec');
      expect(docResponse.statusCode).toBe(200);
      expect(docResponse.json<SpecificationDocumentResponse>().content).toContain(admission?.title);
    } finally {
      await app.close();
    }
  });

  it('never silently enables demonstration data in project mode', async () => {
    const config = passwordConfig();
    const app = await createRuntimeApp({
      ...config,
      authentication: { ...config.authentication, mode: 'none' },
    });
    try {
      const overview = await app.inject('/api/specs/overview');
      expect(overview.statusCode).toBe(503);
      expect(overview.json()).toEqual({ error: 'specification_source_unavailable' });
      const workspace = await app.inject('/api/specs/admission/workspace');
      expect(workspace.statusCode).toBe(503);
      expect(workspace.json()).toEqual({ error: 'specification_source_unavailable' });
    } finally {
      await app.close();
    }
  });

  it('distinguishes unknown specifications and independent details from absent routes', async () => {
    const config = passwordConfig();
    const app = await createRuntimeApp(
      {
        ...config,
        authentication: { ...config.authentication, mode: 'none' },
      },
      { specs: { mode: 'demo' } },
    );
    try {
      const missing = await app.inject('/api/specs/unknown-spec/workspace');
      expect(missing.statusCode).toBe(404);
      expect(missing.json()).toEqual({ error: 'specification_not_found' });
      const missingDoc = await app.inject('/api/specs/admission/documents/not-a-document');
      expect(missingDoc.statusCode).toBe(404);
      expect(missingDoc.json()).toEqual({ error: 'specification_document_not_found' });
      const missingTask = await app.inject('/api/specs/admission/tasks/TASK-99');
      expect(missingTask.statusCode).toBe(404);
      expect(missingTask.json()).toEqual({ error: 'specification_task_not_found' });
      const invalid = await app.inject('/api/specs/invalid%20spec/workspace');
      expect(invalid.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it('authenticates before reading and enforces concrete Specification scopes', async () => {
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
          assignments: [{ userId: 'demo-user', role: 'viewer', scope: { specId: 'security' } }],
        },
      },
      { auth: { store }, specs: { mode: 'demo' } },
    );
    try {
      const anonymous = await app.inject('/api/specs/security/workspace');
      expect(anonymous.statusCode).toBe(401);
      const cookie = authCookieNames(config.server.port).session + '=' + session;
      const denied = await app.inject({
        url: '/api/specs/admission/workspace',
        headers: { cookie },
      });
      expect(denied.statusCode).toBe(403);
      expect(denied.json()).toEqual({ error: 'forbidden' });
      const allowed = await app.inject({
        url: '/api/specs/security/workspace',
        headers: { cookie },
      });
      expect(allowed.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });
});
