import { useQueryClient } from '@tanstack/react-query';
import { useCachedQueryState } from '../../../app/useCachedQueryState';
import { specificationKeys } from '../../specs/queries';
import { getHttpErrorStatus } from '../../specs/httpErrorStatus';
import type { SpecificationWorkspaceData, SessionSummary } from '../../specs/workspace/model';
export type SessionNavigationEntry = SessionSummary & {
  readonly activityCode: 'active' | 'attention';
};
export type SessionNavigationSummary =
  | {
      readonly state: 'available' | 'partial' | 'stale';
      readonly entries: readonly SessionNavigationEntry[];
      readonly count?: number;
      readonly attention: boolean;
    }
  | { readonly state: 'unknown' | 'loading' | 'unavailable' | 'forbidden' };
/** Sessions owns interpretation; reads only the snapshot already loaded by its owner. */
export function projectSessionNavigation(
  data: SpecificationWorkspaceData | undefined,
  error: unknown,
  fetching = false,
): SessionNavigationSummary {
  const status = getHttpErrorStatus(error);
  if ([401, 403, 404].includes(status ?? 0)) return { state: 'forbidden' };
  if (!data) return { state: error ? 'unavailable' : fetching ? 'loading' : 'unknown' };
  const availability = data.sectionAvailability?.sessions;
  if (availability === 'forbidden') return { state: 'forbidden' };
  if (availability && availability !== 'available') return { state: 'unavailable' };
  const entries = data.sessions
    .filter(
      (item): item is SessionNavigationEntry =>
        item.activityCode === 'active' || item.activityCode === 'attention',
    )
    .sort(
      (a, b) => Number(b.activityCode === 'attention') - Number(a.activityCode === 'attention'),
    );
  const partial = data.sessions.some(
    (item) => !item.activityCode && item.navigationStatus !== 'quiet',
  );
  return {
    state: error ? 'stale' : partial ? 'partial' : 'available',
    entries: entries.slice(0, 3),
    count: !partial && !error ? entries.length : undefined,
    attention: entries.some((item) => item.activityCode === 'attention'),
  };
}
export function useSessionNavigationSummary(specId: string | null) {
  const client = useQueryClient();
  const key = specificationKeys.detail(specId ?? '');
  const query = useCachedQueryState<SpecificationWorkspaceData>(key);
  const canRetry = Boolean(client.getQueryCache().find({ queryKey: key, exact: true })?.isActive());
  return {
    ...projectSessionNavigation(
      specId ? query?.data : undefined,
      query?.error,
      query?.fetchStatus === 'fetching',
    ),
    canRetry,
    retry: () =>
      canRetry
        ? client.refetchQueries({ queryKey: key, exact: true, type: 'active' })
        : Promise.resolve(),
  };
}
