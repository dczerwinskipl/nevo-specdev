import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import Fastify, { type FastifyInstance, type RawServerBase } from 'fastify';

import { loadRuntimeConfig, type LoadRuntimeConfigOptions } from './config/index';
import type { RuntimeConfig } from './config/types';
import {
  configureRuntimeApp,
  RUNTIME_FASTIFY_OPTIONS,
  type RuntimeAppDependencies,
} from './server/app';

export interface RuntimeStartOptions extends LoadRuntimeConfigOptions {
  readonly projectRoot: string;
  readonly demo?: boolean;
  readonly dependencies?: RuntimeAppDependencies;
}

export interface RuntimeHandle {
  readonly address: string;
  close(): Promise<void>;
}

export async function startRuntime(options: RuntimeStartOptions): Promise<RuntimeHandle> {
  const loaded = await loadRuntimeConfig(options);
  const app = await createListeningApp(loaded.config, options.projectRoot, {
    ...options.dependencies,
    specs: {
      ...options.dependencies?.specs,
      ...(options.demo ? { mode: 'demo' as const } : {}),
    },
  });

  try {
    const address = await app.listen({
      host: loaded.config.server.host,
      port: loaded.config.server.port,
    });
    return {
      address,
      close: () => app.close(),
    };
  } catch (error) {
    await app.close();
    throw error;
  }
}

async function createListeningApp(
  config: RuntimeConfig,
  cwd: string,
  dependencies: RuntimeAppDependencies | undefined,
) {
  if (!config.server.tls.enabled) {
    return configureOrClose(Fastify(RUNTIME_FASTIFY_OPTIONS), config, dependencies);
  }

  const certFile = config.server.tls.certFile;
  const keyFile = config.server.tls.keyFile;
  if (!certFile || !keyFile) {
    throw new Error('TLS is enabled but certificate files are not configured.');
  }

  const [cert, key] = await Promise.all([
    readFile(resolve(cwd, certFile)),
    readFile(resolve(cwd, keyFile)),
  ]);

  return configureOrClose(
    Fastify({
      ...RUNTIME_FASTIFY_OPTIONS,
      http2: true,
      https: { cert, key, allowHTTP1: true },
    }),
    config,
    dependencies,
  );
}

async function configureOrClose<RawServer extends RawServerBase>(
  app: FastifyInstance<RawServer>,
  config: RuntimeConfig,
  dependencies: RuntimeAppDependencies | undefined,
): Promise<FastifyInstance<RawServer>> {
  try {
    await configureRuntimeApp(app, config, dependencies);
    return app;
  } catch (error) {
    await app.close();
    throw error;
  }
}
