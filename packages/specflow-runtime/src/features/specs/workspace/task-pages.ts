import type { FastifyInstance } from 'fastify';
import { SpecCapabilities } from '@nevo/specflow-contracts/specs';
import { SessionCapabilities } from '@nevo/specflow-contracts/sessions';
import {
  SpecificationTaskParamsSchema,
  TaskPageQuerySchema,
  TaskResourcePageSchema,
  TaskHistoryPageSchema,
  TaskSnapshotExpiredSchema,
  SpecificationReadErrorSchema,
} from '@nevo/specflow-contracts/specs/workspace';
import {
  AuthenticationRequiredErrorResponseSchema,
  AuthorizationForbiddenErrorResponseSchema,
} from '@nevo/specflow-contracts/authorization';
import { requireCapability } from '../../auth';
import type { SpecificationWorkspaceRepository } from './repository';
import { authorizedTaskResources } from './authorize-task-references';

export function registerTaskPages(
  app: FastifyInstance,
  repository?: SpecificationWorkspaceRepository,
) {
  for (const kind of ['resources', 'history'] as const) {
    app.get(
      `/api/specs/:specId/tasks/:taskId/${kind}`,
      {
        preHandler: requireCapability({
          resource: SpecCapabilities,
          capability: SpecCapabilities.capabilities.View,
          scope: (request) => ({ specId: (request.params as { specId: string }).specId }),
        }),
        schema: {
          params: SpecificationTaskParamsSchema,
          querystring: TaskPageQuerySchema,
          response: {
            200: kind === 'resources' ? TaskResourcePageSchema : TaskHistoryPageSchema,
            401: AuthenticationRequiredErrorResponseSchema,
            403: AuthorizationForbiddenErrorResponseSchema,
            404: SpecificationReadErrorSchema,
            409: TaskSnapshotExpiredSchema,
            503: SpecificationReadErrorSchema,
          },
        },
      },
      async (request, reply) => {
        reply.header('Cache-Control', 'no-store');
        const { specId, taskId } = request.params as { specId: string; taskId: string };
        const { token, cursor, limit } = request.query as {
          token: string;
          cursor?: string;
          limit?: string;
        };
        if (
          !repository ||
          (kind === 'resources' ? !repository.readTaskResources : !repository.readTaskHistory)
        )
          return reply.code(503).send({ error: 'specification_source_unavailable' });
        const detail = await repository.readTask(specId, taskId);
        if (!detail) return reply.code(404).send({ error: 'specification_task_not_found' });
        if (detail.task.id !== taskId || detail.snapshot?.specification.id !== specId)
          return reply.code(503).send({ error: 'specification_source_unavailable' });
        const section = detail.snapshot.sections[kind];
        const pageRef =
          section.state === 'available'
            ? kind === 'resources' && 'page' in section.data
              ? section.data.page
              : 'token' in section.data
                ? section.data
                : null
            : null;
        if (!pageRef) return reply.code(503).send({ error: 'specification_source_unavailable' });
        if (token !== pageRef.token)
          return reply.code(409).send({ error: 'task_snapshot_expired' });
        const offset = cursor === undefined ? 0 : Number(cursor);
        if (!Number.isSafeInteger(offset) || offset < 0)
          return reply.code(409).send({ error: 'task_snapshot_expired' });
        const canReadSession = (sessionId: string) =>
          request.authz.can({
            resource: SessionCapabilities,
            capability: SessionCapabilities.capabilities.View,
            scope: { specId, sessionId },
          });
        let items;
        if (kind === 'resources') {
          const all = await repository.readTaskResources!(specId, taskId);
          if (!all) return reply.code(503).send({ error: 'specification_source_unavailable' });
          const visible = authorizedTaskResources(all, specId, canReadSession);
          items = visible.slice(3);
        } else {
          const all = await repository.readTaskHistory!(specId, taskId);
          if (!all) return reply.code(503).send({ error: 'specification_source_unavailable' });
          items = all
            .filter((entry) => entry.key.specId === specId && entry.key.taskId === taskId)
            .map((entry) => ({
              ...entry,
              resources: authorizedTaskResources(entry.resources, specId, canReadSession),
            }));
        }
        const after = await repository.readTask(specId, taskId);
        if (after?.snapshot?.revision !== detail.snapshot.revision)
          return reply.code(409).send({ error: 'task_snapshot_expired' });
        const end = offset + (limit ? Number(limit) : pageRef.initialLimit);
        return {
          token,
          items: items.slice(offset, end),
          nextCursor: end < items.length ? String(end) : null,
          coverage: 'complete',
        };
      },
    );
  }
}
