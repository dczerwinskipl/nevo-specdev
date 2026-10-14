import {
  CreateOperationError,
  GitCapabilityError,
  ProjectControlLockError,
  ProjectHomeError,
  SpecificationError,
  WorkspaceRegistryError,
  createSpecificationFromRequest,
  type CreateSpecificationTarget,
  type SpecFlowEngine,
} from '@nevo/specflow-engine';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyPluginCallback } from 'fastify';
import {
  AuthenticationRequiredErrorResponseSchema,
  AuthorizationForbiddenErrorResponseSchema,
} from '@nevo/specflow-contracts/authorization';
import {
  CreateSpecErrorSchema,
  CreateSpecRequestSchema,
  CreatedSpecSchema,
  SpecCapabilities,
} from '@nevo/specflow-contracts/specs';

import { requireCapability } from '../../auth';
import { statusForCreateError, type CreateErrorCode } from './error-status';

export interface SpecsCreateEndpointOptions {
  readonly engine?: SpecFlowEngine;
}

/**
 * Authorized Runtime transport only. Project-level create is needed because
 * an uncreated Spec has no specId yet. The workspace selector never grants
 * access. Demo/unconfigured Runtime remains read-only and fails closed.
 */
export const specsCreateEndpoint: FastifyPluginCallback<SpecsCreateEndpointOptions> = (
  app,
  options,
  done,
) => {
  app.withTypeProvider<TypeBoxTypeProvider>().post(
    '/api/specs',
    {
      preHandler: requireCapability({
        resource: SpecCapabilities,
        capability: SpecCapabilities.capabilities.Create,
        scope: {},
      }),
      schema: {
        body: CreateSpecRequestSchema,
        response: {
          201: CreatedSpecSchema,
          400: CreateSpecErrorSchema,
          401: AuthenticationRequiredErrorResponseSchema,
          403: AuthorizationForbiddenErrorResponseSchema,
          409: CreateSpecErrorSchema,
          422: CreateSpecErrorSchema,
          503: CreateSpecErrorSchema,
        },
      },
    },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      const engine = options.engine;
      if (!engine) {
        return reply.code(503).send({
          error: 'Engine-backed Spec create is unavailable in this Runtime composition.',
          code: 'ENGINE_UNAVAILABLE',
        });
      }

      try {
        const body = request.body;
        // Resolve default from the verified Project Home (not the HTTP server
        // process cwd or a user-provided, unverified root).
        const target = await resolveCreateTarget(engine, body.target);
        const result = await createSpecificationFromRequest(engine, {
          operationId: body.operationId,
          title: body.title,
          goal: body.goal,
          target,
        });
        return reply.code(201).send(result);
      } catch (error) {
        const code = errorCode(error);
        if (!code) throw error;

        const status = statusForCreateError(code);
        return reply.code(status).send({ error: code, code });
      }
    },
  );
  done();
};

async function resolveCreateTarget(
  engine: SpecFlowEngine,
  target:
    | { readonly kind: 'existing'; readonly workspaceId: string }
    | { readonly kind: 'new-worktree'; readonly baseRef?: string; readonly branch?: string }
    | undefined,
): Promise<CreateSpecificationTarget> {
  switch (target?.kind) {
    case undefined:
      return { kind: 'existing', workspaceId: (await engine.readRegistry()).primaryWorkspaceId };
    case 'existing':
      return { kind: 'existing', workspaceId: target.workspaceId };
    case 'new-worktree':
      return {
        kind: 'new-worktree',
        baseRef: target.baseRef ?? 'HEAD',
        ...(target.branch ? { branch: target.branch } : {}),
      };
    default: {
      const exhaustive: never = target;
      return exhaustive;
    }
  }
}

function errorCode(error: unknown): CreateErrorCode | undefined {
  // Only Engine's public, typed failures are safe transport errors. A Node
  // filesystem error such as EACCES is not a client validation failure and
  // must never be misreported as HTTP 422.
  if (
    error instanceof CreateOperationError ||
    error instanceof ProjectControlLockError ||
    error instanceof GitCapabilityError ||
    error instanceof SpecificationError ||
    error instanceof WorkspaceRegistryError ||
    error instanceof ProjectHomeError
  ) {
    return error.code;
  }
  return undefined;
}

