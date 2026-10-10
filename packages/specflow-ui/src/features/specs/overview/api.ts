import type { HttpRequestClient } from '@nevo/http-client';
import type { SpecsOverview } from '@nevo/specflow-contracts/specs/overview';

import type { SpecsCollection } from './model';

export interface SpecsOverviewApi {
  getOverview(collection: SpecsCollection, signal?: AbortSignal): Promise<SpecsOverview>;
}

export function createRuntimeSpecsOverviewApi(client: HttpRequestClient): SpecsOverviewApi {
  return {
    getOverview: (collection, signal) =>
      client.get<SpecsOverview>('/api/specs/overview', {
        params: { collection },
        signal,
      }),
  };
}
