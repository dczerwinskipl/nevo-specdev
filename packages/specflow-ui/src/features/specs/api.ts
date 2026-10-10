import type { HttpRequestClient } from '@nevo/http-client';
import type { SpecificationWorkspaceResponse } from '@nevo/specflow-contracts/specs/workspace';

export interface SpecificationApi {
  getSpecificationWorkspace(
    specId: string,
    signal?: AbortSignal,
  ): Promise<SpecificationWorkspaceResponse>;
}

export function createRuntimeSpecificationApi(client: HttpRequestClient): SpecificationApi {
  const base = (specId: string) => '/api/specs/' + encodeURIComponent(specId);
  return {
    getSpecificationWorkspace: (specId, signal) =>
      client.get<SpecificationWorkspaceResponse>(base(specId) + '/workspace', { signal }),
  };
}
