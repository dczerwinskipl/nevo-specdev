import { getHttpErrorStatus } from '../httpErrorStatus';
import { specificationKeys } from '../queries';
import type { SpecificationWorkspaceData } from '../workspace/model';
import type { SpecsCollection, SpecsOverview } from './model';
import { specsOverviewKeys } from './queries';
import { useCachedQueryState } from '../../../app/useCachedQueryState';
export interface SpecificationNavigationMetadata {
  readonly title: string;
  readonly key?: string;
  readonly documentCount: number | undefined;
  readonly hasGit: boolean | undefined;
  readonly stale?: boolean;
}
/** Permitted cache-only display identity. Never hydrates Workspace for a deep link. */
export function useSpecificationNavigationMetadata(
  specId: string | null,
  collection: SpecsCollection = 'current',
) {
  const workspace = useCachedQueryState<SpecificationWorkspaceData>(
    specificationKeys.detail(specId ?? ''),
  );
  const catalogue = useCachedQueryState<SpecsOverview>(specsOverviewKeys.collection(collection));
  if (!specId || [401, 403, 404].includes(getHttpErrorStatus(workspace?.error) ?? 0))
    return undefined;
  const catalogueAllowed = ![401, 403, 404].includes(getHttpErrorStatus(catalogue?.error) ?? 0);
  const item = catalogueAllowed
    ? catalogue?.data?.items.find((item) => item.id === specId)
    : undefined;
  const data = workspace?.data;
  return data
    ? {
        title: data.title,
        key: item?.key,
        documentCount:
          data.sectionAvailability?.documents === 'available' || !data.sectionAvailability
            ? data.documents.length
            : undefined,
        hasGit: data.hasGit,
        stale: workspace?.status === 'error' || Boolean(item && catalogue?.status === 'error'),
      }
    : item
      ? {
          title: item.title,
          key: item.key,
          documentCount: undefined,
          hasGit: undefined,
          stale: catalogue?.status === 'error',
        }
      : undefined;
}
