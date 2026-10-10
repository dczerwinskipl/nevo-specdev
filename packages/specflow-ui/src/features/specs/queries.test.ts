import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { invalidateSpecificationWorkspace, specificationKeys } from './queries';
import { taskKeys } from '../tasks/queries';
import { documentKeys } from '../documents/queries';

describe('Specification Query key scope', () => {
  it('refreshes only Workspace without invalidating independent Task, Document or Changes data', async () => {
    const queryClient = new QueryClient();
    const id = 'admission';
    const other = 'security';
    const workspace = specificationKeys.detail(id);
    const task = taskKeys.detail(id, 'TASK-02');
    const document = documentKeys.detail(id, 'spec');
    const changes = specificationKeys.changes(id, 'base');

    for (const key of [workspace, task, document, changes]) {
      queryClient.setQueryData(key, { revision: 1 });
    }
    queryClient.setQueryData(specificationKeys.detail(other), { revision: 2 });

    await invalidateSpecificationWorkspace(queryClient, id);

    expect(queryClient.getQueryState(workspace)?.isInvalidated).toBe(true);
    for (const key of [task, document, changes, specificationKeys.detail(other)]) {
      expect(queryClient.getQueryState(key)?.isInvalidated).toBe(false);
    }
  });

  it('refetches only the active Workspace observer, not active independent detail observers', async () => {
    const client = new QueryClient();
    const specId = 'admission';
    const workspaceKey = specificationKeys.detail(specId);
    const taskKey = taskKeys.detail(specId, 'TASK-01');
    const documentKey = documentKeys.detail(specId, 'spec');
    const changesKey = specificationKeys.changes(specId, 'base');
    const keys = [workspaceKey, taskKey, documentKey, changesKey];
    const requests = keys.map(() => vi.fn(() => Promise.resolve({ revision: 2 })));
    const unsubscribe = keys.map((key, index) => {
      client.setQueryData(key, { revision: 1 });
      const observer = new QueryObserver(client, {
        queryKey: key,
        queryFn: requests[index],
        staleTime: Infinity,
      });
      return observer.subscribe(() => undefined);
    });

    try {
      await invalidateSpecificationWorkspace(client, specId);
      expect(requests[0]).toHaveBeenCalledTimes(1);
      for (const request of requests.slice(1)) {
        expect(request).not.toHaveBeenCalled();
      }
    } finally {
      for (const stop of unsubscribe) stop();
      client.clear();
    }
  });

  it('still permits explicitly requested Specification-wide invalidation for domain mutations', async () => {
    const queryClient = new QueryClient();
    const id = 'admission';
    const keys = [
      specificationKeys.detail(id),
      documentKeys.detail(id, 'spec'),
      taskKeys.detail(id, 'TASK-02'),
    ];
    for (const key of keys) queryClient.setQueryData(key, { revision: 1 });

    await queryClient.invalidateQueries({
      queryKey: specificationKeys.spec(id),
      refetchType: 'none',
    });

    for (const key of keys) {
      expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
    }
  });
});
