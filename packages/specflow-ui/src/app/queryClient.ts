import { QueryClient } from '@tanstack/react-query';

/**
 * Creates an application-scoped TanStack Query client with standard defaults.
 */
export function createSpecFlowQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 30, // 30 seconds
        retry: false,
        retryOnMount: false,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/** Default singleton QueryClient for browser production runtime. */
export const defaultQueryClient: QueryClient = createSpecFlowQueryClient();
