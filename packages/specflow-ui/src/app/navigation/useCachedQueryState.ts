import { useCallback, useSyncExternalStore } from 'react';
import { hashKey, useQueryClient, type QueryKey } from '@tanstack/react-query';
/** Observe an owned query cache entry without creating a request or overwriting its options. */
export function useCachedQueryState<T>(queryKey: QueryKey) {
  const client = useQueryClient();
  const hash = hashKey(queryKey);
  const subscribe = useCallback(
    (notify: () => void) =>
      client.getQueryCache().subscribe((event) => {
        if (
          event.query.queryHash === hash &&
          (event.type === 'updated' || event.type === 'added' || event.type === 'removed')
        )
          queueMicrotask(notify);
      }),
    [client, hash],
  );
  const snapshot = () => client.getQueryState<T>(queryKey);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
