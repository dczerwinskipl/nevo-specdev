import { QueryObserver } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import { createSpecFlowQueryClient } from '../../../app/queryClient';
import { createSpecsFixture } from '../../../../test-support/specs/overview/fixtures';
import { specsOverviewKeys, specsOverviewQueryOptions } from './queries';
import type { SpecsOverview } from './model';

describe('shared Specs catalogue boundary', () => {
  it.each([
    ['wrong collection', createSpecsFixture('archive')],
    ...[NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1].map(
      (total) =>
        [
          `invalid total ${total}`,
          {
            ...createSpecsFixture(),
            items: createSpecsFixture().items.map((item) => ({
              ...item,
              progress: { completed: 0, total },
            })),
          },
        ] as const,
    ),
    [
      'invalid completed',
      {
        ...createSpecsFixture(),
        items: createSpecsFixture().items.map((item) => ({
          ...item,
          progress: { completed: 2, total: 1 },
        })),
      },
    ],
  ] as (readonly [string, SpecsOverview])[])(
    'rejects picker-first %s before shared-cache publication and list entry without refetch',
    async (_case, response) => {
      const client = createSpecFlowQueryClient();
      const getOverview = vi.fn(() => Promise.resolve(response));
      const api = { getOverview };
      // Same options used by the real picker, including its open/enabled gate.
      const picker = new QueryObserver(client, {
        ...specsOverviewQueryOptions(api, 'current'),
        enabled: true,
      });
      const stopPicker = picker.subscribe(() => undefined);
      await vi.waitFor(() => expect(picker.getCurrentResult().status).toBe('error'));
      const key = specsOverviewKeys.collection('current');
      expect(client.getQueryState(key)).toMatchObject({
        status: 'error',
        data: undefined,
        dataUpdatedAt: 0,
      });
      stopPicker();
      const list = new QueryObserver(client, specsOverviewQueryOptions(api, 'current'));
      const stopList = list.subscribe(() => undefined);
      expect(list.getCurrentResult()).toMatchObject({
        status: 'error',
        data: undefined,
        isSuccess: false,
      });
      expect(getOverview).toHaveBeenCalledTimes(1);
      stopList();
      client.clear();
    },
  );
  it('shares good responses, including zero tasks, and retains permitted data after a failed refresh', async () => {
    const client = createSpecFlowQueryClient();
    const projection = {
      ...createSpecsFixture(),
      items: createSpecsFixture().items.map((item) => ({
        ...item,
        progress: { completed: 0, total: 0 },
      })),
    };
    const getOverview = vi
      .fn()
      .mockResolvedValueOnce(projection)
      .mockResolvedValueOnce({ ...projection, collection: 'archive' });
    const options = specsOverviewQueryOptions({ getOverview }, 'current');
    expect(await client.fetchQuery(options)).toEqual(projection);
    expect(await client.fetchQuery(options)).toEqual(projection);
    expect(getOverview).toHaveBeenCalledTimes(1);
    await client.invalidateQueries({ queryKey: options.queryKey });
    await expect(client.fetchQuery(options)).rejects.toThrow('scope mismatch');
    expect(client.getQueryState(options.queryKey)).toMatchObject({
      status: 'error',
      data: projection,
    });
    client.clear();
  });
  it('forwards the query signal and preserves cancellation', async () => {
    const client = createSpecFlowQueryClient();
    let received: AbortSignal | undefined;
    const options = specsOverviewQueryOptions(
      {
        getOverview: (_collection, signal) => {
          received = signal;
          return new Promise((_resolve, reject) =>
            signal?.addEventListener('abort', () => reject(new Error('aborted'))),
          );
        },
      },
      'current',
    );
    const request = client.fetchQuery(options);
    const rejected = expect(request).rejects.toBeDefined();
    await client.cancelQueries({ queryKey: options.queryKey });
    await rejected;
    expect(received?.aborted).toBe(true);
    expect(client.getQueryData(options.queryKey)).toBeUndefined();
    client.clear();
  });
});
