import { useQuery } from '@tanstack/react-query';
import { isHttpClientError } from '@nevo/http-client';
import { useAppServices } from '../../app/useAppServices';
import type { TaskApi } from './api';
import { taskKeys } from './queries';

export function useSpecificationTask(
  specId: string,
  taskId: string,
  api?: TaskApi,
  enabled = true,
) {
  const services = useAppServices();
  const activeApi = api ?? services.taskApi;
  const query = useQuery({
    queryKey: taskKeys.detail(specId, taskId),
    queryFn: ({ signal }) => activeApi.getTask(specId, taskId, signal),
    enabled: enabled && Boolean(specId) && Boolean(taskId),
  });
  const httpError = isHttpClientError(query.error) ? query.error : undefined;
  const errorStatus = httpError?.status;
  const data = httpError?.data;
  const isTaskNotFound =
    errorStatus === 404 &&
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    data.error === 'specification_task_not_found';
  return { ...query, errorStatus, isTaskNotFound };
}
