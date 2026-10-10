import type { QueryClient } from '@tanstack/react-query';

export const specificationKeys = {
  all: ['specifications'] as const,
  spec: (specId: string) => [...specificationKeys.all, specId] as const,
  detail: (specId: string) => [...specificationKeys.spec(specId), 'workspace'] as const,
  changes: (specId: string, source: string) =>
    [...specificationKeys.spec(specId), 'changes', source] as const,
};

/**
 * Refresh only the coherent Workspace steering snapshot. Task details, opened
 * documents and Git Changes have their own freshness and refresh lifecycles.
 * Broad "spec" prefix invalidation would accidentally refetch all of them.
 */
export function invalidateSpecificationWorkspace(queryClient: QueryClient, specId: string) {
  return queryClient.invalidateQueries({
    queryKey: specificationKeys.detail(specId),
    exact: true,
    refetchType: 'active',
  });
}
