import { createHttpClient, type HttpClient } from '@nevo/http-client';

import { createBrowserAuthApi, type AuthApi } from '../auth/api';
import { createRuntimeInfoApi, type RuntimeInfoApi } from './runtimeInfoApi';
import { createAuthStore, type AuthStore } from '../auth/store';
import { createAuthRecoveryCoordinator, type AuthRecoveryCoordinator } from '../auth/recovery';
import { createProtectedRuntimeHttpClient } from './createProtectedRuntimeHttpClient';
import {
  createRuntimeSpecsOverviewApi,
  type SpecsOverviewApi,
} from '../features/specs/overview/api';
import { createRuntimeSpecificationApi, type SpecificationApi } from '../features/specs/api';
import { createRuntimeTaskApi, type TaskApi } from '../features/tasks/api';
import { createRuntimeDocumentApi, type DocumentApi } from '../features/documents/api';

export interface SpecFlowAppServices {
  readonly runtimeInfoApi: RuntimeInfoApi;
  readonly authApi: AuthApi;
  readonly authStore: AuthStore;
  readonly authRecovery: AuthRecoveryCoordinator;
  readonly specsOverviewApi: SpecsOverviewApi;
  readonly specificationApi: SpecificationApi;
  readonly taskApi: TaskApi;
  readonly documentApi: DocumentApi;
}

export type SpecFlowServices = SpecFlowAppServices;

export interface SpecFlowServicesOptions {
  readonly http?: HttpClient;
  readonly runtimeInfoApi?: RuntimeInfoApi;
  readonly authApi?: AuthApi;
  readonly authStore?: AuthStore;
  readonly authRecovery?: AuthRecoveryCoordinator;
  readonly specsOverviewApi?: SpecsOverviewApi;
  readonly specificationApi?: SpecificationApi;
  readonly taskApi?: TaskApi;
  readonly documentApi?: DocumentApi;
}

export function createSpecFlowAppServices(
  optionsOrClient: SpecFlowServicesOptions | HttpClient = {},
): SpecFlowAppServices {
  const options: SpecFlowServicesOptions =
    'get' in optionsOrClient && 'post' in optionsOrClient
      ? { http: optionsOrClient }
      : optionsOrClient;

  const http = options.http ?? createHttpClient();
  const authApi = options.authApi ?? createBrowserAuthApi(http);
  const authStore = options.authStore ?? createAuthStore(authApi);
  const authRecovery = options.authRecovery ?? createAuthRecoveryCoordinator(authStore);
  const runtimeHttp = createProtectedRuntimeHttpClient(http, authRecovery);

  const specsOverviewApi = options.specsOverviewApi ?? createRuntimeSpecsOverviewApi(runtimeHttp);

  const specificationApi = options.specificationApi ?? createRuntimeSpecificationApi(runtimeHttp);

  return {
    runtimeInfoApi: options.runtimeInfoApi ?? createRuntimeInfoApi(runtimeHttp),
    authApi,
    authStore,
    authRecovery,
    specsOverviewApi,
    specificationApi,
    taskApi: options.taskApi ?? createRuntimeTaskApi(runtimeHttp),
    documentApi: options.documentApi ?? createRuntimeDocumentApi(runtimeHttp),
  };
}

export const defaultSpecFlowServices: SpecFlowAppServices = createSpecFlowAppServices();
