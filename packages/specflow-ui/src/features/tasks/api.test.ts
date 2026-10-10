import { createHttpClient } from '@nevo/http-client';
import { describe, expect, it, vi } from 'vitest';
import { createRuntimeTaskApi } from './api';
import { taskKeys } from './queries';

describe('Task feature HTTP and query identity', () => {
  it('uses the injected HttpClient and encodes both path params', async () => {
    const http = createHttpClient();
    const get = vi.spyOn(http, 'get').mockResolvedValue({});
    const signal = new AbortController().signal;
    await createRuntimeTaskApi(http).getTask('spec 1', 'TASK/02', signal);
    expect(get).toHaveBeenCalledWith('/api/specs/spec%201/tasks/TASK%2F02', { signal });
  });

  it('preserves the Specification-scoped cache invalidation hierarchy', () => {
    expect(taskKeys.detail('a', 't')).toEqual(['specifications', 'a', 'task', 't']);
  });
});
