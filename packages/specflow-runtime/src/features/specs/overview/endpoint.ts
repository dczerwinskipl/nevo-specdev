import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyPluginCallback } from 'fastify';
import {
  GitCapabilityError,
  ProjectHomeError,
  SpecificationError,
  WorkspaceRegistryError,
} from '@nevo/specflow-engine';
import {
  AuthenticationRequiredErrorResponseSchema,
  AuthorizationForbiddenErrorResponseSchema,
} from '@nevo/specflow-contracts/authorization';
import { SpecCapabilities } from '@nevo/specflow-contracts/specs';
import {
  SpecsOverviewQuerySchema,
  SpecsOverviewReadErrorSchema,
  SpecsOverviewSchema,
  type CurrentSpecSectionId,
} from '@nevo/specflow-contracts/specs/overview';

import { requireCapabilityInAnyScope } from '../../auth';
import type { SpecsOverviewRepository } from './repository/read-repository';
import { SpecsReadError, type SpecsReadErrorCode } from '../read/error';
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
          503: SpecsOverviewReadErrorSchema,
          401: AuthenticationRequiredErrorResponseSchema,
          403: AuthorizationForbiddenErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      if (!options.repository) {
        return reply.code(503).send({
          error: 'Engine-backed Specifications are unavailable.',
          code: 'ENGINE_UNAVAILABLE',
        });
      }
      try {
        return await (request.query.collection === 'archive'
        ? getArchiveOverview({
            authorization: request.authz,
            repository: options.repository,
          })
        : getCurrentOverview({
            authorization: request.authz,
            repository: options.repository,
            sections: options.currentSections,
          }));
      } catch (error) {
        const code = readErrorCode(error);
        if (!code) throw error;
        return reply.code(503).send({ error: code, code });
      }
    },
  );

  done();
};

function readErrorCode(error: unknown): SpecsReadErrorCode | undefined {
  if (error instanceof SpecsReadError) return error.code;
  if (
    error instanceof SpecificationError ||
    error instanceof WorkspaceRegistryError ||
    error instanceof ProjectHomeError ||
    error instanceof GitCapabilityError
  ) {
    return 'SPEC_SOURCE_UNAVAILABLE';
  }
  return undefined;
}
