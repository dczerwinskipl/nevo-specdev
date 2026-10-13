import type { FastifyPluginCallback } from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  SpecificationDocumentParamsSchema,
  SpecificationDocumentResponseSchema,
  DocumentQuerySchema,
  DocumentRevisionUnavailableSchema,
  DocumentReadErrorSchema,
} from '@nevo/specflow-contracts/documents';
import {
  AuthenticationRequiredErrorResponseSchema,
  AuthorizationForbiddenErrorResponseSchema,
} from '@nevo/specflow-contracts/authorization';
import { SpecCapabilities } from '@nevo/specflow-contracts/specs';
import { requireCapability } from '../../auth';
import { readDocumentContent, type DocumentContentSource } from './read-document';

export const documentContentEndpoint: FastifyPluginCallback<{ source?: DocumentContentSource }> = (
  app,
  options,
  done,
) => {
  app.withTypeProvider<TypeBoxTypeProvider>().get(
    '/api/specs/:specId/documents/:documentId',
    {
      preHandler: requireCapability({
        resource: SpecCapabilities,
        capability: SpecCapabilities.capabilities.View,
        scope: (request) => ({ specId: (request.params as { specId: string }).specId }),
      }),
      schema: {
        params: SpecificationDocumentParamsSchema,
        querystring: DocumentQuerySchema,
        response: {
          200: SpecificationDocumentResponseSchema,
          401: AuthenticationRequiredErrorResponseSchema,
          403: AuthorizationForbiddenErrorResponseSchema,
          404: DocumentReadErrorSchema,
          409: DocumentRevisionUnavailableSchema,
          503: DocumentReadErrorSchema,
        },
      },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      const result = await readDocumentContent(
        options.source,
        request.params.specId,
        request.params.documentId,
        request.query.revision,
        request.authz,
      );
      if (result.kind === 'ok') return result.value;
      if (result.kind === 'not_found')
        return reply.code(404).send({ error: 'specification_document_not_found' });
      if (result.kind === 'revision_unavailable')
        return reply.code(409).send({ error: 'document_revision_unavailable' });
      return reply.code(503).send({ error: 'specification_source_unavailable' });
    },
  );
  done();
};
