import type { HttpRequestClient } from '@nevo/http-client';
import type { SpecificationTaskResponse } from '@nevo/specflow-contracts/specs/workspace';

/** Task detail reads are owned by the Tasks feature, even under a Specification URL. */
export interface TaskApi {
  getTask(specId: string, taskId: string, signal?: AbortSignal): Promise<SpecificationTaskResponse>;
}

export function createRuntimeTaskApi(client: HttpRequestClient): TaskApi {
  return {
    getTask: (specId, taskId, signal) =>
      client.get<SpecificationTaskResponse>(
        '/api/specs/' + encodeURIComponent(specId) + '/tasks/' + encodeURIComponent(taskId),
        { signal },
      ),
  };
}
