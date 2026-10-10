import { useEffect, type ReactNode } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { authSessionIdentity, type AuthStore } from '../auth/store';

/** Install application cache isolation once per AuthStore/QueryClient pair. */
export function bindAuthQueryCache(auth: AuthStore, queryClient: QueryClient): () => void {
  let previousIdentity: string | undefined;
  const sync = () => {
    const state = auth.getState();
    if (state.status === 'ready') {
      const session = state.session;
      const identity = authSessionIdentity(session);
      if (previousIdentity !== undefined && previousIdentity !== identity) {
        void queryClient.cancelQueries();
        queryClient.clear();
      }
      previousIdentity = identity;
    } else if (state.status === 'loading' && state.reason === 'logout') {
      void queryClient.cancelQueries();
      queryClient.clear();
      previousIdentity = undefined;
    }
  };
  sync();
  return auth.subscribe(sync);
}

/**
 * AuthStore controls bootstrap, while TanStack Query owns feature data.
 * Purge feature cache only on a real authentication boundary change.
 * Revalidating a previously confirmed session must not erase feature data.
 */
export function AuthQueryCacheBoundary({
  auth,
  children,
}: {
  readonly auth: AuthStore;
  readonly children: ReactNode;
}) {
  const queryClient = useQueryClient();

  useEffect(() => bindAuthQueryCache(auth, queryClient), [auth, queryClient]);

  return <>{children}</>;
}
