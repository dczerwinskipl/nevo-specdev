import type { HttpRequestClient } from '@nevo/http-client';
import type { RuntimeInfoResponse } from '@nevo/specflow-contracts/runtime';

export interface RuntimeInfoApi {
  getInfo(signal?: AbortSignal): Promise<RuntimeInfoResponse>;
}
export function createRuntimeInfoApi(client: HttpRequestClient): RuntimeInfoApi {
  return {
    getInfo: (signal) => client.get<RuntimeInfoResponse>('/api/runtime/info', { signal }),
  };
}
