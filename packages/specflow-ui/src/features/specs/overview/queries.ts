import type { SpecsCollection } from './model';
import { queryOptions } from '@tanstack/react-query';
import type { SpecsOverviewApi } from './api';

export const specsOverviewKeys = {
  all: ['specs-overview'] as const,
  collection: (collection: SpecsCollection) => [...specsOverviewKeys.all, collection] as const,
};

/** Every producer of this shared catalogue key validates before data enters the cache. */
export function specsOverviewQueryOptions(api: SpecsOverviewApi, collection: SpecsCollection) {
  return queryOptions({
    queryKey: specsOverviewKeys.collection(collection),
    queryFn: async ({ signal }) => {
      const projection = await api.getOverview(collection, signal);
      if (projection.collection !== collection) throw new Error('Specs projection scope mismatch.');
      if (
        projection.items.some(
          ({ progress }) =>
            !Number.isSafeInteger(progress.total) ||
            progress.total < 0 ||
            !Number.isSafeInteger(progress.completed) ||
            progress.completed < 0 ||
            progress.completed > progress.total,
        )
      )
        throw new Error('Invalid Specs progress aggregate.');
      return projection;
    },
  });
}
