import { describe, expect, it, vi } from 'vitest';
import { createRuntimeDocumentApi } from './api';
import { documentKeys } from './queries';
import { createHttpClient } from '@nevo/http-client';
describe('DocumentApi', () => {
  it('fetches Document Detail by identity independently of the workspace projection', async () => {
    const http = createHttpClient();
    const get = vi
      .spyOn(http, 'get')
      .mockResolvedValue({ id: 'main', title: 'Main', content: '# Hello', revision: '1' });
    const signal = new AbortController().signal;
    const result = await createRuntimeDocumentApi(http).getDocument('a b', 'main', signal);
    expect(get).toHaveBeenCalledWith('/api/specs/a%20b/documents/main', { signal });
    expect(result.content).toBe('# Hello');
  });
});
describe('Versioned document client', () => {
  it('sends exact opaque revision and keeps latest/v1/v2 caches distinct', async () => {
    const http = createHttpClient();
    const get = vi
      .spyOn(http, 'get')
      .mockResolvedValue({ id: 'report', title: 'Report', content: 'Old', revision: 'v1 /#?' });
    const api = createRuntimeDocumentApi(http);
    const signal = new AbortController().signal;
    await api.getDocument('admission', 'report', signal, 'v1 /#?');
    expect(get).toHaveBeenCalledWith(
      '/api/specs/admission/documents/report?revision=v1%20%2F%23%3F',
      { signal },
    );
    await api.getDocument('admission', 'report', signal);
    expect(get).toHaveBeenLastCalledWith('/api/specs/admission/documents/report', { signal });
    const keys = [
      documentKeys.detail('s', 'd'),
      documentKeys.detail('s', 'd', 'v1'),
      documentKeys.detail('s', 'd', 'v2'),
    ];
    expect(new Set(keys.map((key) => JSON.stringify(key))).size).toBe(3);
  });
});
