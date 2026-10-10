import { useQuery } from '@tanstack/react-query';
import { getHttpErrorStatus } from '../httpErrorStatus';
import { specificationKeys } from '../queries';
import type { SpecificationWorkspaceData } from '../workspace/model';

export interface SpecificationNavigationMetadata {
  readonly title: string;
  readonly documentCount: number | undefined;
  readonly hasGit: boolean | undefined;
}

/**
 * Sidebar reads only an existing Workspace cache entry; it never fetches the
 * aggregate to render navigation for a directly opened Task or Document.
 * A dedicated lightweight Runtime navigation read model may replace this
 * cache-only adapter when the backend exposes one.
 */
export function useSpecificationNavigationMetadata(specId: string | null) {
  const query = useQuery<SpecificationWorkspaceData, Error, SpecificationNavigationMetadata>({
    queryKey: specificationKeys.detail(specId ?? ''),
    enabled: false,
    select: (data) => ({
      title: data.title,
      // Unavailable/forbidden data is not an authoritative empty collection.
      documentCount:
        data.sectionAvailability?.documents === 'available' || !data.sectionAvailability
          ? data.documents.length
          : undefined,
      hasGit: data.hasGit,
    }),
  });
  // A resource-wide access denial can arrive after a successful snapshot.
  // React Query retains stale data on refetch errors; do not leak titles/counts
  // from that snapshot into navigation after access is revoked or the Spec is gone.
  const status = getHttpErrorStatus(query.error);
  const invalidResource = status === 401 || status === 403 || status === 404;
  return specId && !invalidResource ? query.data : undefined;
}
