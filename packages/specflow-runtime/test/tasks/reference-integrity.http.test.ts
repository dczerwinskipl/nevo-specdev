import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { createAuthorization } from '@nevo/authorization';
import { SpecCapabilities } from '@nevo/specflow-contracts/specs';
import { SessionCapabilities } from '@nevo/specflow-contracts/sessions';
import type { SpecificationTaskResponse } from '@nevo/specflow-contracts/tasks';
import { createRequestAuthorization } from '../../src/features/auth/authorization/request-authorization';
import { registerRuntimeErrorHandler } from '../../src/server/error-handler';
import { taskReadEndpoint } from '../../src/features/tasks/endpoint';
import { specificationWorkspaceEndpoint } from '../../src/features/specs/workspace/endpoint';
import { PageLeases } from '../../src/features/tasks/reads/page-leases';
import { createDemoTaskSources } from '../../src/features/tasks';
import { createDemoSpecsRepositories } from '../../src/features/specs';
import type { TasksFeatureDependencies } from '../../src/features/tasks';
import type { TaskReadDependencies } from '../../src/features/tasks/detail/read-task-detail';
import type { WorkspaceContributions } from '../../src/features/specs/workspace/repository';
import { demoTaskResources, demoTaskHistory } from '../../src/features/tasks/demo/execution';
import type { TaskHistoryPage } from '@nevo/specflow-contracts/tasks';
import type { ReferenceVisibility } from '../../src/features/tasks/reads/facts';

async function fixture() {
  const demo = createDemoSpecsRepositories(),
    sources = createDemoTaskSources(demo.catalogue);
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
      title: 'Inspect materials',
      instruction: null,
      state: 'pending',
      actions: [],
      evidence: [],
    },
  ];
  execution.pendingCount = 1;
  const subject = { kind: 'user' as const, id: 'alice' };
  const authorization = createAuthorization({
    resources: [SpecCapabilities, SessionCapabilities],
    roles: {
      specs: [SpecCapabilities.capabilities.View],
      sessions: [SessionCapabilities.capabilities.View],
    },
    assignments: [
      { subject, role: 'specs', scope: { specId: 'admission' } },
      { subject, role: 'sessions', scope: { specId: 'admission', sessionId: 'allowed-session' } },
    ],
  });
  const authz = createRequestAuthorization({ mode: 'subject', subject }, authorization);
  const deps: TaskReadDependencies = {
    ...sources,
    definitions: { resolve: () => Promise.resolve(definition) },
    execution: { inspect: () => Promise.resolve(execution) },
    leases: new PageLeases(),
  };
  return { demo, definition, execution, authz, deps };
}
async function appFor(
  f: Awaited<ReturnType<typeof fixture>>,
  sessions: TasksFeatureDependencies['sessions'],
  contributions?: WorkspaceContributions,
) {
  const app = Fastify();
  registerRuntimeErrorHandler(app);
  app.decorateRequest('authz', { getter: () => f.authz });
  app.register(taskReadEndpoint, { dependencies: { ...f.deps, sessions } });
  app.register(specificationWorkspaceEndpoint, {
    repository: f.demo.workspaceRepository,
    contributions: contributions ?? f.demo.contributions,
    sessions,
  });
  return app;
}
describe('Reference identity and projection integrity HTTP', () => {
  it('never transfers a Session grant from a substituted identity to the original reference', async () => {
    const f = await fixture();
    const link = {
      state: 'available' as const,
      target: { kind: 'session' as const, sessionId: 'protected-session' },
    };
    f.execution.requirements[0]!.evidence = [{ title: 'Protected session content', link }];
    f.definition.dependencies = [{ taskId: 'secret-task', title: 'Protected dependency', link }];
    f.execution.recovery = {
      id: 'secret-recovery',
      state: 'required',
      summary: 'Protected recovery',
      link,
    };
    const candidates = demoTaskResources('admission', 'TASK-03').slice(0, 4);
    candidates[0] = { ...candidates[0]!, title: 'Protected resource', link };
    const permitted = async (visible: ReferenceVisibility) => {
      const result = [];
      for (const item of candidates) if (await visible(item.link)) result.push(item);
      return result;
    };
    f.deps.resources = {
      open: async (identity, visible) => ({
        identity,
        handle: 'resources',
        version: '1',
        coverage: 'complete',
        visibleTotal: (await permitted(visible)).length,
      }),
      read: async (identity, _handle, _next, _limit, visible) => ({
        identity,
        version: '1',
        items: await permitted(visible),
        next: null,
        coverage: 'complete',
      }),
    };
    f.deps.history = {
      open: (identity) =>
        Promise.resolve({ identity, handle: 'history', version: '1', coverage: 'complete' }),
      read: (identity) =>
        Promise.resolve({
          identity,
          version: '1',
          items: [{ ...demoTaskHistory('admission', 'TASK-03')[0]!, resources: candidates }],
          next: null,
          coverage: 'complete',
        }),
    };
    const owner = {
      resolve: () => Promise.resolve({ ...f.definition.identity, sessionId: 'allowed-session' }),
    };
    expect(
      f.authz.can({
        resource: SessionCapabilities,
        capability: SessionCapabilities.capabilities.View,
        scope: { specId: 'admission', sessionId: 'protected-session' },
      }),
    ).toBe(false);
    const app = await appFor(f, owner);
    try {
      const response = await app.inject('/api/specs/admission/tasks/TASK-03');
      expect(response.statusCode).toBe(200);
      expect(response.body).not.toContain('protected-session');
      expect(response.body).not.toContain('Protected');
      expect(response.body).not.toContain('secret-');
      const snapshot = response.json<SpecificationTaskResponse>().snapshot!,
        resources = snapshot.sections.resources,
        history = snapshot.sections.history;
      expect(resources.state === 'available' && resources.data.visibleTotal).toBe(3);
      if (history.state !== 'available') throw Error('Expected history');
      const page = await app.inject(
        '/api/specs/admission/tasks/TASK-03/history?token=' +
          encodeURIComponent(history.data.token),
      );
      expect(page.statusCode).toBe(200);
      expect(page.json<TaskHistoryPage>().items[0]!.resources).toHaveLength(3);
      expect(page.body).not.toContain('Protected');
      expect(page.body).not.toContain('protected-session');
    } finally {
      await app.close();
    }
  });
  it('rejects substituted identities in Workspace summaries, attention and activity as well', async () => {
    const f = await fixture();
    const readSpecification = f.demo.workspaceRepository.readSpecification.bind(
      f.demo.workspaceRepository,
    );
    f.demo.workspaceRepository.readSpecification = async (specId) => {
      const data = await readSpecification(specId);
      return data
        ? {
            ...data,
            sections: {
              ...data.sections,
              activity: {
                state: 'available',
                data: {
                  items: [
                    {
                      id: 'private-activity',
                      kind: 'info',
                      relatedSessionId: 'protected-session',
                      occurredAt: '2026-10-13',
                      title: 'Protected activity',
                      description: 'Private',
                    },
                  ],
                },
              },
            },
          }
        : null;
    };
    const app = await appFor(
      f,
      {
        resolve: () => Promise.resolve({ ...f.definition.identity, sessionId: 'allowed-session' }),
      },
      {
        sessions: () =>
          Promise.resolve({
            recommendedSessionId: 'protected-session',
            section: {
              state: 'available',
              data: {
                items: [
                  {
                    id: 'protected-session',
                    title: 'Protected summary',
                    taskIds: [],
                    status: 'active',
                  },
                ],
                attention: [
                  {
                    id: 'secret-attention',
                    kind: 'session',
                    targetId: 'protected-session',
                    title: 'Protected attention',
                    reason: 'Private',
                  },
                ],
              },
            },
          }),
      },
    );
    try {
      const response = await app.inject('/api/specs/admission/workspace');
      expect(response.statusCode).toBe(200);
      expect(response.body).not.toContain('protected-session');
      expect(response.body).not.toContain('Protected');
    } finally {
      await app.close();
    }
  });
  it('changes revision when the same Session owner changes visibility, preserving an opened report index', async () => {
    const f = await fixture();
    let sameWorkspace = true;
    const report = (id: string) => ({
      title: id,
      link: {
        state: 'available' as const,
        target: { kind: 'document' as const, specId: 'admission', documentId: id, revision: 'v1' },
      },
    });
    f.execution.requirements[0]!.evidence = [
      {
        title: 'Session',
        link: { state: 'available', target: { kind: 'session', sessionId: 'allowed-session' } },
      },
      report('report-A'),
      report('report-B'),
    ];
    const app = await appFor(f, {
      resolve: (sessionId) =>
        Promise.resolve({
          ...f.definition.identity,
          sessionId,
          workspaceId: sameWorkspace ? f.definition.identity.workspaceId : 'other-workspace',
        }),
    });
    try {
      const read = async () => {
        const response = await app.inject('/api/specs/admission/tasks/TASK-03');
        expect(response.statusCode).toBe(200);
        return response.json<SpecificationTaskResponse>().snapshot!;
      };
      const before = await read(),
        stable = await read();
      expect(stable.revision).toBe(before.revision);
      if (
        before.sections.history.state !== 'available' ||
        stable.sections.history.state !== 'available'
      )
        throw Error('Expected page handles');
      expect(stable.sections.history.data.token).not.toBe(before.sections.history.data.token);
      if (before.sections.humanRequirements.state !== 'available') throw Error('Expected evidence');
      expect(before.sections.humanRequirements.data.items[0]!.evidence[1]!.title).toBe('report-A');
      sameWorkspace = false;
      const after = await read();
      if (after.sections.humanRequirements.state !== 'available') throw Error('Expected evidence');
      expect(after.sections.humanRequirements.data.items[0]!.evidence[1]!.title).toBe('report-B');
      expect(after.revision).not.toBe(before.revision);
      sameWorkspace = true;
      expect((await read()).revision).toBe(before.revision);
    } finally {
      await app.close();
    }
  });
});
