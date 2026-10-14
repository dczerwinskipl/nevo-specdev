import { randomUUID } from 'node:crypto';

import {
  CreateOperationError,
  GitCapabilityError,
  ProjectControlLockError,
  ProjectHomeError,
  SpecificationError,
  WorkspaceRegistryError,
  createSpecification,
  inspectCreateSpecification,
  type CreateSpecificationInput,
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
        const target: CreateSpecificationInput['target'] =
          body.target?.kind === 'new-worktree'
            ? {
                kind: 'new-worktree',
                baseRef: body.target.baseRef ?? 'HEAD',
                ...(body.target.branch ? { branch: body.target.branch } : {}),
              }
            : {
                kind: 'existing',
                workspaceId:
                  body.target?.kind === 'existing'
                    ? body.target.workspaceId
                    : (await engine.readRegistry()).primaryWorkspaceId,
              };
        const existing = body.operationId
          ? await inspectCreateSpecification(engine, body.operationId)
          : undefined;
        const input: CreateSpecificationInput = {
          operationId: body.operationId ?? randomUUID(),
          title: body.title,
          created: existing?.created ?? new Date().toISOString().slice(0, 10),
          ...(body.goal ? { goal: body.goal } : {}),
          target,
        };

        const result = await createSpecification(engine, input);
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

function errorCode(error: unknown): string | undefined {
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

function statusForCreateError(code: string): 400 | 409 | 422 | 503 {
  if (code.includes('VALIDATION') || code === 'CREATE_OPERATION_INVALID') return 400;
  if (
    code === 'CREATE_CONFLICT' ||
    code === 'SPEC_CONFLICT' ||
    code === 'BRANCH_ALREADY_EXISTS' ||
    code === 'BRANCH_ALREADY_CHECKED_OUT' ||
    code === 'WORKTREE_PATH_CONFLICT'
  )
    return 409;
  if (
    code.includes('RECOVERY') ||
    code.includes('CORRUPT') ||
    code.includes('MISMATCH') ||
    code === 'GIT_UNAVAILABLE' ||
    code === 'CONTROL_LOCK_BUSY' ||
    code === 'CONTROL_LOCK_CORRUPT' ||
    code === 'CONTROL_LOCK_OWNERSHIP_LOST' ||
    code === 'CONTROL_LOCK_INVALID_HOME' ||
    code === 'GIT_OPERATION_UNCERTAIN'
  )
    return 503;
  return 422;
}
