import { createHttpClient } from '@nevo/http-client';
import { describe, expect, it, vi } from 'vitest';
import { createRuntimeDocumentApi } from './api';

describe('DocumentApi', () => {
  it('fetches Document Detail by identity independently of the workspace projection', async () => {
    const http = createHttpClient();
    const get = vi.spyOn(http, 'get').mockResolvedValue({
      id: 'main',
      title: 'Main',
      content: '# Hello',
      revision: '1',
    });
    const signal = new AbortController().signal;
    const result = await createRuntimeDocumentApi(http).getDocument('a b', 'main', signal);
    expect(get).toHaveBeenCalledWith('/api/specs/a%20b/documents/main', { signal });
    expect(result.content).toBe('# Hello');
  });
});
