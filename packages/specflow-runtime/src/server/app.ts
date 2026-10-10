import cookie from '@fastify/cookie';
import { RuntimeInfoResponseSchema } from '@nevo/specflow-contracts/runtime';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { CapabilityId } from '@nevo/authorization';
import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
  type RawServerBase,
} from 'fastify';

import {
  createAuthFeature,
  type AuthFeatureDependencies,
  type SpecFlowRoleId,
} from '../features/auth';
import type { RuntimeConfig } from '../config/types';
import { createSessionsFeature, SessionCapabilities } from '../features/sessions';
import { createSettingsFeature, SettingsCapabilities } from '../features/settings';
import {
  createSpecsFeature,
  SpecCapabilities,
  type SpecsFeatureDependencies,
} from '../features/specs';
import type { RuntimeFeature } from '../features/runtime-feature';
import { registerRuntimeErrorHandler } from './error-handler';
import { serializeRuntimeRequest } from './logging';
import { isRequestAtPublicOrigin } from './origin';
import { registerRuntimeWebApp, type RuntimeWebApp } from './web-app';

export interface RuntimeAppDependencies {
  readonly auth?: AuthFeatureDependencies;
  readonly specs?: SpecsFeatureDependencies;
  readonly webApp?: RuntimeWebApp;
}

export const RUNTIME_FASTIFY_OPTIONS = {
  logger: {
    level: 'warn',
    stream: process.stderr,
    serializers: {
      req: serializeRuntimeRequest,
    },
  },
  ajv: {
    customOptions: {
      coerceTypes: false,
      removeAdditional: false,
    },
  },
} satisfies FastifyServerOptions;

export async function createRuntimeApp(
  config: RuntimeConfig,
  dependencies: RuntimeAppDependencies = {},
): Promise<FastifyInstance> {
  const app = Fastify(RUNTIME_FASTIFY_OPTIONS);
  await configureRuntimeApp(app, config, dependencies);
  return app;
}

export async function configureRuntimeApp<RawServer extends RawServerBase>(
  app: FastifyInstance<RawServer>,
  config: RuntimeConfig,
  dependencies: RuntimeAppDependencies = {},
): Promise<void> {
  await app.register(cookie);
  registerRuntimeErrorHandler(app);

  const productFeatures: readonly RuntimeFeature[] = [
    createSpecsFeature({
      ...(config.specs ? { config: config.specs } : {}),
      ...(dependencies.specs ? { dependencies: dependencies.specs } : {}),
    }),
    createSessionsFeature(),
    createSettingsFeature(),
  ];

  const authFeature = createAuthFeature({
    authentication: config.authentication,
    ...(config.authorization ? { authorization: config.authorization } : {}),
    authorizationResources: productFeatures.flatMap((feature) => feature.authorizationResources),
    roles: specFlowRoleCapabilities(),
    ...(config.server.publicOrigin ? { publicOrigin: config.server.publicOrigin } : {}),
    serverPort: config.server.port,
    secureCookies: config.server.tls.enabled,
    ...(dependencies.auth ? { dependencies: dependencies.auth } : {}),
  });

  await authFeature.register(app);

  app.withTypeProvider<TypeBoxTypeProvider>().get(
    '/api/runtime/info',
    {
      schema: { response: { 200: RuntimeInfoResponseSchema } },
    },
    (_request, reply) => {
      reply.header('Cache-Control', 'no-store');
      return {
        dataMode: dependencies.specs?.mode === 'demo' ? ('demo' as const) : ('project' as const),
      };
    },
  );

  for (const feature of productFeatures) {
    await feature.register?.(app);
  }

  if (dependencies.webApp) {
    registerRuntimeWebApp(app, dependencies.webApp);
    return;
  }

  app.get('/', (request, reply) => {
    if (
      config.server.publicOrigin &&
      !isRequestAtPublicOrigin(config.server.publicOrigin, request.host, config.server.tls.enabled)
    ) {
      return reply.redirect(config.server.publicOrigin);
    }

    return {
      service: 'Nevo SpecFlow Runtime API',
      status: 'ok',
      message: 'This address serves the Runtime API, not the SpecFlow web UI.',
    };
  });
}

function specFlowRoleCapabilities(): Readonly<Record<SpecFlowRoleId, readonly CapabilityId[]>> {
  const viewer = [
    SpecCapabilities.capabilities.View,
    SessionCapabilities.capabilities.View,
  ] as const;

  const developer = [
    ...viewer,
    SpecCapabilities.capabilities.Create,
    SpecCapabilities.capabilities.Manage,
    SessionCapabilities.capabilities.Create,
    SessionCapabilities.capabilities.Manage,
  ] as const;

  return {
    viewer,
    developer,
    admin: [
      ...developer,
      SettingsCapabilities.capabilities.View,
      SettingsCapabilities.capabilities.Manage,
    ],
  };
}
