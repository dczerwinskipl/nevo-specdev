import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyPluginCallback } from 'fastify';
import {
  SpecificationReadErrorSchema,
  SpecificationWorkspaceParamsSchema,
  SpecificationWorkspaceResponseSchema,
} from '@nevo/specflow-contracts/specs/workspace';
import {
  AuthenticationRequiredErrorResponseSchema,
  AuthorizationForbiddenErrorResponseSchema,
} from '@nevo/specflow-contracts/authorization';
import { SpecCapabilities } from '@nevo/specflow-contracts/specs';
import { requireCapability } from '../../auth';
import type { SpecificationWorkspaceRepository, WorkspaceContributions } from './repository';
import { readAuthorizedWorkspace } from './read-authorized-workspace';
import type { SessionReferenceOwner } from '../../sessions';

export interface SpecificationWorkspaceEndpointOptions {
  readonly repository?: SpecificationWorkspaceRepository;
  readonly contributions?: WorkspaceContributions;
  readonly sessions?: SessionReferenceOwner;
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
      const result = await readAuthorizedWorkspace(
        options.repository,
        options.contributions,
        request.params.specId,
        request.authz,
        options.sessions,
      );
      if (result.kind === 'ok') return result.value;
      if (result.kind === 'not_found')
        return reply.code(404).send({ error: 'specification_not_found' });
      return reply.code(503).send({ error: 'specification_source_unavailable' });
    },
  );

  done();
};
