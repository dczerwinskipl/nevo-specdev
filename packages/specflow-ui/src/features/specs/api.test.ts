import { createHttpClient } from '@nevo/http-client';
import { describe, expect, it, vi } from 'vitest';
import { createRuntimeSpecificationApi } from './api';

describe('SpecificationApi transport', () => {
  it('reads Specification workspace using the injected client and cancellation', async () => {
    const http = createHttpClient();
    const get = vi.spyOn(http, 'get').mockResolvedValue({});
    const api = createRuntimeSpecificationApi(http);
    const signal = new AbortController().signal;
    await api.getSpecificationWorkspace('a b', signal);
    expect(get).toHaveBeenNthCalledWith(1, '/api/specs/a%20b/workspace', { signal });
  });
});
