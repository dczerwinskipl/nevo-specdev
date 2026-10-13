import { describe, expect, it } from 'vitest';
import { createAuthorization } from '@nevo/authorization';
import { SpecCapabilities } from '@nevo/specflow-contracts/specs';
import { SessionCapabilities } from '@nevo/specflow-contracts/sessions';
import { createRequestAuthorization } from '../../src/features/auth/authorization/request-authorization';
import { createDemoSpecsRepositories } from '../../src/features/specs';
import { createDemoTaskSources } from '../../src/features/tasks';
import { readTaskDetail } from '../../src/features/tasks/detail/read-task-detail';
import { PageLeases } from '../../src/features/tasks/reads/page-leases';
import { createRuntimeApp } from '../../src/server/app';
import { passwordConfig } from '../auth/support/config';
import type { SpecificationTaskResponse } from '@nevo/specflow-contracts/tasks';

describe('Task reference authorization and incomplete source regression', () => {
  it.each([false, true])(
    'keeps spec and session permissions independent (Session access=%s)',
    async (sessionAccess) => {
      const sources = createDemoTaskSources(createDemoSpecsRepositories().catalogue);
      const definition = (await sources.definitions!.resolve('admission', 'TASK-03'))!;
      const execution = (await sources.execution!.inspect(
        definition.identity,
        definition.version,
      ))!;
      execution.requirements = [
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
          actions: [{ label: 'Confirm', feedbackRequired: false }],
          evidence: [
            {
              title: 'Protected session description',
              link: {
                state: 'available',
                target: { kind: 'session', sessionId: 'protected-session' },
              },
            },
            {
              title: 'Secret foreign document',
              link: {
                state: 'available',
                target: {
                  kind: 'document',
                  specId: 'secret-spec',
                  documentId: 'secret-document',
                  revision: '1',
                },
              },
            },
          ],
        },
      ];
      definition.dependencies = execution.requirements[0]!.evidence.map((item, index) => ({
        ...item,
        taskId: 'dependency-' + index,
      }));
      execution.recovery = {
        id: 'recovery',
        state: 'stopped',
        summary: 'Protected recovery',
        link: execution.requirements[0]!.evidence[0]!.link,
      };
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
            ? [
                {
                  subject,
                  role: 'sessions',
                  scope: { specId: 'actual-owner', sessionId: 'protected-session' },
                },
              ]
            : []),
        ],
      });
      const authz = createRequestAuthorization({ mode: 'subject', subject }, authorization);
      const deps = {
        ...sources,
        leases: new PageLeases(),
        definitions: { resolve: () => Promise.resolve(definition) },
        execution: { inspect: () => Promise.resolve(execution) },
        sessions: {
          resolve: (sessionId: string) =>
            Promise.resolve({
              sessionId,
              specId: 'actual-owner',
              projectId: definition.identity.projectId,
              workspaceId: definition.identity.workspaceId,
            }),
        },
      };
      const result = await readTaskDetail(deps, 'admission', 'TASK-03', authz);
      expect(result.kind).toBe('ok');
      if (result.kind !== 'ok') throw Error('Expected detail');
      const body = JSON.stringify(result.value);
      expect(body).not.toContain('secret-');
      expect(body).not.toContain('Secret foreign');
      expect(body.includes('protected-session')).toBe(sessionAccess);
      const human = result.value.snapshot!.sections.humanRequirements;
      expect(human.state === 'available' && human.data.items[0]!.actions).toEqual([]);
      expect(human.state === 'available' && human.data.items[0]!.inspectionProblem).toBe(
        'Required material cannot be accessed.',
      );
      expect(execution.requirements[0]!.evidence).toHaveLength(2);
    },
  );
  it('returns explicit unavailable over HTTP without a resource reader rather than shrinking the count', async () => {
    const sources = createDemoTaskSources(createDemoSpecsRepositories().catalogue),
      config = passwordConfig();
    const app = await createRuntimeApp(
      { ...config, authentication: { ...config.authentication, mode: 'none' } },
      { tasks: { ...sources, resources: undefined } },
    );
    try {
      const response = await app.inject('/api/specs/admission/tasks/TASK-03');
      expect(response.statusCode).toBe(200);
      expect(response.json<SpecificationTaskResponse>().snapshot!.sections.resources).toEqual({
        state: 'unavailable',
        reason: 'not_implemented',
      });
    } finally {
      await app.close();
    }
  });
});
