import { useQuery } from '@tanstack/react-query';
import { isHttpClientError } from '@nevo/http-client';

import type { SpecsCollection, SpecsOverviewState } from './model';
import type { SpecsOverviewApi } from './api';
import { specsOverviewQueryOptions } from './queries';

export function useSpecsOverview(api: SpecsOverviewApi, collection: SpecsCollection) {
  const query = useQuery(specsOverviewQueryOptions(api, collection));

  const state: SpecsOverviewState = {
    collection,
    projection: query.data?.collection === collection ? query.data : undefined,
    loading: query.isLoading,
    refreshing: query.isRefetching,
    error: query.isError,
    errorStatus: query.error && isHttpClientError(query.error) ? query.error.status : undefined,
  };

  return {
    state,
    refresh: () => {
      void query.refetch();
    },
  };
}
