import type { SpecsCollection } from './model';

export const specsOverviewKeys = {
  all: ['specs-overview'] as const,
  collection: (collection: SpecsCollection) => [...specsOverviewKeys.all, collection] as const,
};
