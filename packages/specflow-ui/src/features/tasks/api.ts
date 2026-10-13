import type { HttpRequestClient } from '@nevo/http-client';
import type {
  SpecificationTaskResponse,
  TaskResourcePage,
  TaskHistoryPage,
} from '@nevo/specflow-contracts/specs/workspace';

/** Task detail reads are owned by the Tasks feature, even under a Specification URL. */
export interface TaskApi {
  getTask(specId: string, taskId: string, signal?: AbortSignal): Promise<SpecificationTaskResponse>;
  getResources?(
    specId: string,
    taskId: string,
    token: string,
    cursor?: string,
    signal?: AbortSignal,
  ): Promise<TaskResourcePage>;
  getHistory?(
    specId: string,
    taskId: string,
    token: string,
    cursor?: string,
    signal?: AbortSignal,
  ): Promise<TaskHistoryPage>;
}

export function createRuntimeTaskApi(client: HttpRequestClient): TaskApi {
  return {
    getResources: (specId, taskId, token, cursor, signal) =>
      client.get<TaskResourcePage>(taskPageUrl(specId, taskId, 'resources', token, cursor), {
        signal,
      }),
    getHistory: (specId, taskId, token, cursor, signal) =>
      client.get<TaskHistoryPage>(taskPageUrl(specId, taskId, 'history', token, cursor), {
        signal,
      }),
    getTask: (specId, taskId, signal) =>
      client.get<SpecificationTaskResponse>(
        '/api/specs/' + encodeURIComponent(specId) + '/tasks/' + encodeURIComponent(taskId),
        { signal },
      ),
  };
}

function taskPageUrl(specId: string, taskId: string, kind: string, token: string, cursor?: string) {
  const query = new URLSearchParams({ token });
  if (cursor) query.set('cursor', cursor);
  return `/api/specs/${encodeURIComponent(specId)}/tasks/${encodeURIComponent(taskId)}/${kind}?${query}`;
}
