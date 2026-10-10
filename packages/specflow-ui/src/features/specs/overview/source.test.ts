import { describe, expect, it, vi } from 'vitest';
import { createHttpClient } from '@nevo/http-client';

import { createSpecsFixture } from '../../../../test-support/specs/overview/fixtures';
import { createRuntimeSpecsOverviewApi } from './api';

describe('Runtime Specs Overview API', () => {
  it('reads the typed collection through the shared HTTP client with cancellation', async () => {
    const client = createHttpClient();
    const projection = createSpecsFixture('archive');
    const get = vi.spyOn(client, 'get').mockResolvedValue(projection);
    const signal = new AbortController().signal;

    expect(await createRuntimeSpecsOverviewApi(client).getOverview('archive', signal)).toEqual(
      projection,
    );
    expect(get).toHaveBeenCalledWith('/api/specs/overview', {
      params: { collection: 'archive' },
      signal,
    });
  });

  it('propagates transport errors without a fixture fallback', async () => {
    const client = createHttpClient();
    vi.spyOn(client, 'get').mockRejectedValue(new Error('authentication_required'));
    await expect(
      createRuntimeSpecsOverviewApi(client).getOverview('current', new AbortController().signal),
    ).rejects.toThrow('authentication_required');
  });
});
