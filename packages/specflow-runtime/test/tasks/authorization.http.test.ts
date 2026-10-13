import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { createAuthorization } from '@nevo/authorization';
import { SpecCapabilities } from '@nevo/specflow-contracts/specs';
import { SessionCapabilities } from '@nevo/specflow-contracts/sessions';
import type { SpecificationTaskResponse, TaskResourcePage } from '@nevo/specflow-contracts/tasks';
import { createRequestAuthorization } from '../../src/features/auth/authorization/request-authorization';
import { registerRuntimeErrorHandler } from '../../src/server/error-handler';
import { taskReadEndpoint } from '../../src/features/tasks/endpoint';
import { PageLeases } from '../../src/features/tasks/reads/page-leases';
import { createDemoTaskSources } from '../../src/features/tasks';
import { createDemoSpecsRepositories } from '../../src/features/specs';

describe('Task read authorization through the real HTTP adapter', () => {
  it('redacts Session metadata and invalidates existing tokens after subject/policy change', async () => {
    const sources = createDemoTaskSources(createDemoSpecsRepositories().catalogue);
    const definition = (await sources.definitions!.resolve('admission', 'TASK-03'))!;
    const execution = (await sources.execution!.inspect(definition.identity, definition.version))!;
    execution.requirements = [
      {
        id: 'gate',
        definitionRevision: '1',
        source: {
          kind: 'human-gate',
          gateId: 'gate',
          phase: 'exit',
          role: 'owner',
          scope: 'task',
          targetId: 'TASK-03',
        },
        key: null,
        title: 'Inspect evidence',
        instruction: null,
        state: 'pending',
        actions: [],
        evidence: [
          {
            title: 'Protected session description',
            link: {
              state: 'available',
              target: { kind: 'session', sessionId: 'protected-session' },
            },
          },
        ],
      },
    ];
    const subject = { kind: 'user' as const, id: 'alice' };
    const policy = (sessionAccess: boolean) =>
      createAuthorization({
        resources: [SpecCapabilities, SessionCapabilities],
        roles: {
          specs: [SpecCapabilities.capabilities.View],
          sessions: [SessionCapabilities.capabilities.View],
        },
        assignments: [
          { subject, role: 'specs', scope: { specId: 'admission' } },
          ...(sessionAccess
            ? [
                {
                  subject,
                  role: 'sessions',
                  scope: { specId: 'session-owner', sessionId: 'protected-session' },
                },
              ]
            : []),
        ],
      });
    let authorization = policy(true),
      user = subject;
    const app = Fastify();
    registerRuntimeErrorHandler(app);
    app.decorateRequest('authz', {
      getter: () => createRequestAuthorization({ mode: 'subject', subject: user }, authorization),
    });
    app.register(taskReadEndpoint, {
      dependencies: {
        ...sources,
        execution: { inspect: () => Promise.resolve(execution) },
        sessions: {
          resolve: (sessionId) =>
            Promise.resolve({ ...definition.identity, specId: 'session-owner', sessionId }),
        },
        leases: new PageLeases(),
      },
    });
    try {
      const url = '/api/specs/admission/tasks/TASK-03';
      const detail = await app.inject(url);
      expect(detail.statusCode).toBe(200);
      expect(detail.body).toContain('Protected session description');
      const section = detail.json<SpecificationTaskResponse>().snapshot!.sections.resources;
      if (section.state !== 'available') throw Error('Expected resources');
      const pageUrl = url + '/resources?token=' + encodeURIComponent(section.data.page!.token);
      expect((await app.inject(pageUrl)).json<TaskResourcePage>().items.length).toBeGreaterThan(0);
      authorization = policy(false);
      expect((await app.inject(pageUrl)).statusCode).toBe(409);
      const denied = await app.inject(url);
      expect(denied.statusCode).toBe(200);
      expect(denied.json<SpecificationTaskResponse>().snapshot!.revision).not.toBe(
        detail.json<SpecificationTaskResponse>().snapshot!.revision,
      );
      expect(denied.body).not.toContain('protected-session');
      expect(denied.body).not.toContain('Protected session description');
      user = { kind: 'user', id: 'bob' };
      expect((await app.inject(pageUrl)).statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });
});
