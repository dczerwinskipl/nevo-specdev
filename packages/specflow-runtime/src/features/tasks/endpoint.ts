import type { FastifyPluginCallback } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  SpecificationTaskParamsSchema,
  SpecificationTaskResponseSchema,
  TaskPageQuerySchema,
  TaskResourcePageSchema,
  TaskHistoryPageSchema,
  TaskSnapshotExpiredSchema,
  TaskReadErrorSchema,
} from '@nevo/specflow-contracts/tasks';
import {
  AuthenticationRequiredErrorResponseSchema,
  AuthorizationForbiddenErrorResponseSchema,
} from '@nevo/specflow-contracts/authorization';
import { SpecCapabilities } from '@nevo/specflow-contracts/specs';
import { requireCapability } from '../auth';
import { readTaskDetail, type TaskReadDependencies } from './detail/read-task-detail';
import { readTaskPage } from './reads/read-page';

export const taskReadEndpoint: FastifyPluginCallback<{ dependencies: TaskReadDependencies }> = (
  app,
  options,
  done,
) => {
  const authorization = requireCapability({
    resource: SpecCapabilities,
    capability: SpecCapabilities.capabilities.View,
    scope: (request) => ({ specId: (request.params as { specId: string }).specId }),
  });
  const errors = {
    401: AuthenticationRequiredErrorResponseSchema,
    403: AuthorizationForbiddenErrorResponseSchema,
    404: TaskReadErrorSchema,
    409: TaskSnapshotExpiredSchema,
    503: TaskReadErrorSchema,
  };
  app.withTypeProvider<TypeBoxTypeProvider>().get(
    '/api/specs/:specId/tasks/:taskId',
    {
      preHandler: authorization,
      schema: {
        params: SpecificationTaskParamsSchema,
        response: { 200: SpecificationTaskResponseSchema, ...errors },
      },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      const result = await readTaskDetail(
        options.dependencies,
        request.params.specId,
        request.params.taskId,
        request.authz,
      );
      if (result.kind === 'ok') return result.value;
      if (result.kind === 'not_found')
        return reply.code(404).send({ error: 'specification_task_not_found' });
      return reply.code(503).send({ error: 'specification_source_unavailable' });
    },
  );
  for (const kind of ['resources', 'history'] as const)
    app.withTypeProvider<TypeBoxTypeProvider>().get(
      `/api/specs/:specId/tasks/:taskId/${kind}`,
      {
        preHandler: authorization,
        schema: {
          params: SpecificationTaskParamsSchema,
          querystring: TaskPageQuerySchema,
          response: {
            200: kind === 'resources' ? TaskResourcePageSchema : TaskHistoryPageSchema,
            ...errors,
          },
        },
      },
      async (request, reply) => {
        reply.header('Cache-Control', 'no-store');
        const result = await readTaskPage(
          options.dependencies,
          kind,
          request.params.specId,
          request.params.taskId,
          request.query,
          request.authz,
        );
        if (result.kind === 'ok') return result.value;
        if (result.kind === 'expired')
          return reply.code(409).send({ error: 'task_snapshot_expired' });
        if (result.kind === 'not_found')
          return reply.code(404).send({ error: 'specification_task_not_found' });
        return reply.code(503).send({ error: 'specification_source_unavailable' });
      },
    );
  done();
};
