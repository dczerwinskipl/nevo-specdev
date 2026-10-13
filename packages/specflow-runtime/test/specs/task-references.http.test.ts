import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { createAuthorization } from '@nevo/authorization';
import { SpecCapabilities } from '@nevo/specflow-contracts/specs';
import { SessionCapabilities } from '@nevo/specflow-contracts/sessions';
import type { SpecificationTaskResponse, TaskLink } from '@nevo/specflow-contracts/specs/workspace';
import { createRequestAuthorization } from '../../src/features/auth/authorization/request-authorization';
import { specificationWorkspaceEndpoint } from '../../src/features/specs/workspace/endpoint';
import { createDemoSpecsRepositories } from '../../src/features/specs/demo/repositories';
import type { SpecificationWorkspaceRepository } from '../../src/features/specs/workspace/repository';

async function appFor(repository: SpecificationWorkspaceRepository, sessionAccess: boolean) {
  const app = Fastify();
  const subject = { kind: 'user' as const, id: 'reader' };
  const authorization = createAuthorization({
    resources: [SpecCapabilities, SessionCapabilities],
    roles: {
      specs: [SpecCapabilities.capabilities.View],
      sessions: [SessionCapabilities.capabilities.View],
    },
    assignments: [
      { subject, role: 'specs', scope: { specId: 'admission' } },
      ...(sessionAccess
        ? [{ subject, role: 'sessions', scope: { sessionId: 'allowed-session' } }]
        : []),
    ],
  });
  app.decorateRequest('authz', {
    getter: () => createRequestAuthorization({ mode: 'subject', subject }, authorization),
  });
  app.register(specificationWorkspaceEndpoint, { repository });
  return app;
}

describe('Task reference authorization HTTP projection', () => {
  it.each([false, true])(
    'filters every reference surface with session access=%s',
    async (sessionAccess) => {
      const { workspaceRepository } = createDemoSpecsRepositories();
      const task = (await workspaceRepository.readTask('admission', 'TASK-03'))!;
      const snapshot = task.snapshot!;
      const requirements = snapshot.sections.humanRequirements;
      if (requirements.state !== 'available') throw new Error('Expected requirements');
      const links: { title: string; link: TaskLink }[] = [
        {
          title: 'Allowed session description',
          link: { state: 'available', target: { kind: 'session', sessionId: 'allowed-session' } },
        },
        {
          title: 'Secret session description',
          link: { state: 'available', target: { kind: 'session', sessionId: 'secret-session' } },
        },
        {
          title: 'Legal document',
          link: {
            state: 'available',
            target: { kind: 'document', specId: 'admission', documentId: 'spec', revision: '1' },
          },
        },
        ...(['task', 'document', 'report', 'changes', 'requirement'] as const).map(
          (kind): { title: string; link: TaskLink } => ({
            title: `Secret foreign ${kind}`,
            link: {
              state: 'available',
              target: {
                kind,
                specId: 'secret-spec',
                taskId: 'secret-task',
                documentId: 'secret-document',
                reportId: 'secret-report',
                comparisonId: 'secret-changes',
                requirementId: 'secret-requirement',
                revision: '1',
              },
            },
          }),
        ),
      ];
      requirements.data.items = [
        {
          id: 'gate',
          definitionRevision: '1',
          source: {
            kind: 'human-gate',
            gateId: 'gate',
            phase: 'exit',
            role: 'reviewer',
            scope: 'task',
            targetId: 'TASK-03',
          },
          key: null,
          title: 'Check materials',
          instruction: null,
          state: 'pending',
          actions: [],
          evidence: links,
        },
      ];
      requirements.data.pendingCount = 1;
      snapshot.sections.dependencies = {
        state: 'available',
        data: { items: links.map((item, index) => ({ ...item, taskId: `dependency-${index}` })) },
      };
      snapshot.sections.recovery = {
        state: 'available',
        data: {
          id: 'secret-recovery',
          summary: 'Secret recovery description',
          state: 'stopped',
          link: links[1]!.link,
        },
      };
      const sourceResources = (await workspaceRepository.readTaskResources!(
        'admission',
        'TASK-03',
      ))!;
      const resources = links.map((item, index) => ({
        ...sourceResources[0]!,
        ...item,
        id: `ref-${index}`,
      }));
      const app = await appFor(
        {
          ...workspaceRepository,
          readTask: () => Promise.resolve(task),
          readTaskResources: () => Promise.resolve(resources),
          readTaskHistory: async () => [
            {
              ...(await workspaceRepository.readTaskHistory!('admission', 'TASK-03'))![0]!,
              resources,
            },
          ],
        },
        sessionAccess,
      );
      try {
        const response = await app.inject('/api/specs/admission/tasks/TASK-03');
        expect(response.statusCode).toBe(200);
        const body = response.json<SpecificationTaskResponse>();
        const human = body.snapshot!.sections.humanRequirements;
        expect(
          human.state === 'available' && human.data.items[0]!.evidence.map((item) => item.title),
        ).toEqual(
          sessionAccess ? ['Allowed session description', 'Legal document'] : ['Legal document'],
        );
        expect(body.snapshot!.sections.recovery).toEqual({ state: 'forbidden' });
        const history = snapshot.sections.history;
        if (history.state !== 'available') throw new Error('Expected history');
        const historyResponse = await app.inject(
          `/api/specs/admission/tasks/TASK-03/history?token=${encodeURIComponent(history.data.token)}`,
        );
        expect(historyResponse.statusCode).toBe(200);
        for (const output of [response.body, historyResponse.body]) {
          expect(output).not.toContain('Secret');
          expect(output).not.toContain('secret-');
          if (!sessionAccess) expect(output).not.toContain('allowed-session');
        }
        // A denied request cannot poison a shared adapter snapshot for a later authorized request.
        expect(requirements.data.items[0]!.evidence).toHaveLength(links.length);
        expect(snapshot.sections.recovery.state).toBe('available');
      } finally {
        await app.close();
      }
    },
  );

  it.each([
    { total: 12, count: 3, page: false, reader: false, available: false },
    { total: 12, count: 3, page: true, reader: false, available: false },
    { total: 3, count: 3, page: false, reader: false, available: true },
    { total: 0, count: 0, page: false, reader: false, available: true },
    { total: 2, count: 3, page: false, reader: false, available: false },
    { total: 12, count: 3, page: false, reader: true, available: false },
    { total: 12, count: 3, page: true, reader: true, available: true },
  ])(
    'never presents an incomplete resource source as complete: %j',
    async ({ total, count, page, reader, available }) => {
      const { workspaceRepository } = createDemoSpecsRepositories();
      const task = (await workspaceRepository.readTask('admission', 'TASK-03'))!;
      const section = task.snapshot!.sections.resources;
      if (section.state !== 'available') throw new Error('Expected resources');
      section.data.recommended = section.data.recommended.slice(0, count);
      section.data.visibleTotal = total;
      if (!page) section.data.page = null;
      const app = await appFor(
        {
          ...workspaceRepository,
          readTask: () => Promise.resolve(task),
          readTaskResources: reader
            ? async () =>
                (await workspaceRepository.readTaskResources!('admission', 'TASK-03'))!.slice(
                  0,
                  total,
                )
            : undefined,
        },
        false,
      );
      try {
        const response = await app.inject('/api/specs/admission/tasks/TASK-03');
        expect(response.statusCode).toBe(200);
        const resources = response.json<SpecificationTaskResponse>().snapshot!.sections.resources;
        expect(resources.state).toBe(available ? 'available' : 'unavailable');
        if (resources.state === 'available') expect(resources.data.visibleTotal).toBe(total);
        expect(section.data.visibleTotal).toBe(total);
      } finally {
        await app.close();
      }
    },
  );
});
