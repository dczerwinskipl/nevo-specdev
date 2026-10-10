import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyPluginCallback } from 'fastify';
import {
  SpecificationDocumentParamsSchema,
  SpecificationDocumentResponseSchema,
  SpecificationReadErrorSchema,
  SpecificationTaskParamsSchema,
  SpecificationTaskResponseSchema,
  SpecificationWorkspaceParamsSchema,
  SpecificationWorkspaceResponseSchema,
} from '@nevo/specflow-contracts/specs/workspace';
import {
  AuthenticationRequiredErrorResponseSchema,
  AuthorizationForbiddenErrorResponseSchema,
} from '@nevo/specflow-contracts/authorization';
import { SpecCapabilities } from '@nevo/specflow-contracts/specs';
import { SessionCapabilities } from '@nevo/specflow-contracts/sessions';
import { requireCapability } from '../../auth';
import type { SpecificationWorkspaceRepository } from './repository';
import { presentWorkspace } from './presenter';
import { authorizeSessionReferences } from './authorize-projection';

export interface SpecificationWorkspaceEndpointOptions {
  readonly repository?: SpecificationWorkspaceRepository;
}

export const specificationWorkspaceEndpoint: FastifyPluginCallback<
  SpecificationWorkspaceEndpointOptions
> = (app, options, done) => {
  const authorization = requireCapability({
    resource: SpecCapabilities,
    capability: SpecCapabilities.capabilities.View,
    scope: (request) => ({ specId: (request.params as { specId: string }).specId }),
  });

  app.withTypeProvider<TypeBoxTypeProvider>().get(
    '/api/specs/:specId/workspace',
    {
      preHandler: authorization,
      schema: {
        params: SpecificationWorkspaceParamsSchema,
        response: {
          200: SpecificationWorkspaceResponseSchema,
          401: AuthenticationRequiredErrorResponseSchema,
          403: AuthorizationForbiddenErrorResponseSchema,
          404: SpecificationReadErrorSchema,
          503: SpecificationReadErrorSchema,
        },
      },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      if (!options.repository) {
        return reply.code(503).send({ error: 'specification_source_unavailable' });
      }
      const data = await options.repository.readWorkspace(request.params.specId);
      if (!data) return reply.code(404).send({ error: 'specification_not_found' });
      if (data.specification.id !== request.params.specId) {
        throw new Error('Workspace source returned a mismatched Specification identifier.');
      }
      return authorizeSessionReferences(presentWorkspace(data), (sessionId) =>
        request.authz.can({
          resource: SessionCapabilities,
          capability: SessionCapabilities.capabilities.View,
          scope: { specId: request.params.specId, sessionId },
        }),
      );
    },
  );

  app.withTypeProvider<TypeBoxTypeProvider>().get(
    '/api/specs/:specId/documents/:documentId',
    {
      preHandler: authorization,
      schema: {
        params: SpecificationDocumentParamsSchema,
        response: {
          200: SpecificationDocumentResponseSchema,
          401: AuthenticationRequiredErrorResponseSchema,
          403: AuthorizationForbiddenErrorResponseSchema,
          404: SpecificationReadErrorSchema,
          503: SpecificationReadErrorSchema,
        },
      },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      if (!options.repository)
        return reply.code(503).send({ error: 'specification_source_unavailable' });
      const document = await options.repository.readDocument(
        request.params.specId,
        request.params.documentId,
      );
      if (document && document.id !== request.params.documentId) {
        throw new Error('Document source returned a mismatched identifier.');
      }
      return document ?? reply.code(404).send({ error: 'specification_document_not_found' });
    },
  );

  app.withTypeProvider<TypeBoxTypeProvider>().get(
    '/api/specs/:specId/tasks/:taskId',
    {
      preHandler: authorization,
      schema: {
        params: SpecificationTaskParamsSchema,
        response: {
          200: SpecificationTaskResponseSchema,
          401: AuthenticationRequiredErrorResponseSchema,
          403: AuthorizationForbiddenErrorResponseSchema,
          404: SpecificationReadErrorSchema,
          503: SpecificationReadErrorSchema,
        },
      },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      if (!options.repository)
        return reply.code(503).send({ error: 'specification_source_unavailable' });
      const task = await options.repository.readTask(request.params.specId, request.params.taskId);
      if (task && task.task.id !== request.params.taskId) {
        throw new Error('Task source returned a mismatched identifier.');
      }
      return task ?? reply.code(404).send({ error: 'specification_task_not_found' });
    },
  );

  done();
};
