import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyPluginCallback } from 'fastify';
import {
  AuthenticationRequiredErrorResponseSchema,
  AuthorizationForbiddenErrorResponseSchema,
} from '@nevo/specflow-contracts/authorization';
import { SpecCapabilities } from '@nevo/specflow-contracts/specs';
import { SpecificationReadErrorSchema } from '@nevo/specflow-contracts/specs/workspace';
import {
  SpecsOverviewQuerySchema,
  SpecsOverviewSchema,
  type CurrentSpecSectionId,
} from '@nevo/specflow-contracts/specs/overview';

import { requireCapabilityInAnyScope } from '../../auth';
import type { SpecsOverviewRepository } from './repository/read-repository';
import { getArchiveOverview } from './archive/get-overview';
import { getCurrentOverview } from './current/get-overview';

export interface SpecsOverviewEndpointOptions {
  readonly repository?: SpecsOverviewRepository;
  readonly currentSections: readonly CurrentSpecSectionId[];
}

export const specsOverviewEndpoint: FastifyPluginCallback<SpecsOverviewEndpointOptions> = (
  app,
  options,
  done,
) => {
  app.withTypeProvider<TypeBoxTypeProvider>().get(
    '/api/specs/overview',
    {
      preHandler: requireCapabilityInAnyScope({
        resource: SpecCapabilities,
        capability: SpecCapabilities.capabilities.View,
      }),
      schema: {
        querystring: SpecsOverviewQuerySchema,
        response: {
          200: SpecsOverviewSchema,
          401: AuthenticationRequiredErrorResponseSchema,
          403: AuthorizationForbiddenErrorResponseSchema,
          503: SpecificationReadErrorSchema,
        },
      },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');

      const repository = options.repository;
      if (!repository) {
        reply.code(503);
        return { error: 'specification_source_unavailable' } as const;
      }

      return request.query.collection === 'archive'
        ? await getArchiveOverview({
            authorization: request.authz,
            repository,
          })
        : await getCurrentOverview({
            authorization: request.authz,
            repository,
            sections: options.currentSections,
          });
    },
  );

  done();
};
