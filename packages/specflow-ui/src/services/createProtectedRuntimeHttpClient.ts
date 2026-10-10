import {
  isHttpClientError,
  type HttpClient,
  type HttpRequestClient,
  type HttpMethod,
  type HttpRequestConfig,
  type HttpRequestOptions,
  type SseEvent,
  type SseRequestConfig,
  type SseStream,
} from '@nevo/http-client';
import type { AuthRecoveryCoordinator } from '../auth/recovery';
import { AuthSessionSupersededError } from '../auth/store';

/**
 * A single application-owned protected view over the shared transport.
 * Authentication endpoints use the undecorated transport, preventing recursion.
 * The raw Axios escape hatch is never used by typed feature APIs.
 */
export function createProtectedRuntimeHttpClient(
  client: HttpClient,
  recovery: AuthRecoveryCoordinator,
): HttpRequestClient {
  async function run<T>(
    method: HttpMethod,
    signal: AbortSignal | undefined,
    operation: () => Promise<T>,
  ): Promise<T> {
    const request = recovery.snapshot();
    try {
      const result = await operation();
      if (!recovery.isCurrent(request)) throw new AuthSessionSupersededError();
      return result;
    } catch (error) {
      if (!isHttpClientError(error) || error.status !== 401 || signal?.aborted) throw error;
      const result = await recovery.recover(request);
      // Never replay mutations; an HTTP error does not prove the server did
      // not apply side effects before returning it.
      if (result !== 'retry' || (method !== 'get' && method !== 'head') || signal?.aborted) {
        throw error;
      }
      const replayed = await operation(); // One bounded replay; second 401 escapes unchanged.
      if (!recovery.isCurrent(request)) throw new AuthSessionSupersededError();
      return replayed;
    }
  }

  return {
    request<TResponse, TBody, TParams>(config: HttpRequestConfig<TBody, TParams>) {
      return run<TResponse>(config.method, config.signal, () =>
        client.request<TResponse, TBody, TParams>(config),
      );
    },
    get<TResponse, TParams>(url: string, config?: HttpRequestOptions<TParams>) {
      return run<TResponse>('get', config?.signal, () =>
        client.get<TResponse, TParams>(url, config),
      );
    },
    delete<TResponse, TParams>(url: string, config?: HttpRequestOptions<TParams>) {
      return run<TResponse>('delete', config?.signal, () =>
        client.delete<TResponse, TParams>(url, config),
      );
    },
    post<TResponse, TBody, TParams>(
      url: string,
      body?: TBody,
      config?: HttpRequestOptions<TParams>,
    ) {
      return run<TResponse>('post', config?.signal, () =>
        client.post<TResponse, TBody, TParams>(url, body, config),
      );
    },
    put<TResponse, TBody, TParams>(
      url: string,
      body?: TBody,
      config?: HttpRequestOptions<TParams>,
    ) {
      return run<TResponse>('put', config?.signal, () =>
        client.put<TResponse, TBody, TParams>(url, body, config),
      );
    },
    patch<TResponse, TBody, TParams>(
      url: string,
      body?: TBody,
      config?: HttpRequestOptions<TParams>,
    ) {
      return run<TResponse>('patch', config?.signal, () =>
        client.patch<TResponse, TBody, TParams>(url, body, config),
      );
    },
    sse<TEvent = SseEvent, TParams = unknown>(
      url: string,
      config?: SseRequestConfig<TEvent, TParams>,
    ): SseStream<TEvent> {
      const request = recovery.snapshot();
      const stream = client.sse(url, config);
      let unsubscribe: (() => void) | undefined;
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        unsubscribe?.();
        unsubscribe = undefined;
        stream.close();
      };
      const ensureCurrentSession = () => {
        if (!recovery.isCurrent(request)) {
          close();
          throw new AuthSessionSupersededError();
        }
      };
      return {
        get lastEventId() {
          return stream.lastEventId;
        },
        close,
        async *[Symbol.asyncIterator]() {
          ensureCurrentSession();
          if (closed) return;
          // Active cancellation must not depend on another event arriving.
          unsubscribe = recovery.subscribeInvalidation(request, close);
          try {
            for await (const event of stream) {
              ensureCurrentSession();
              if (closed) return;
              yield event;
            }
          } catch (error) {
            if (
              isHttpClientError(error) &&
              error.status === 401 &&
              !config?.signal?.aborted &&
              recovery.isCurrent(request)
            ) {
              // Session check only: SSE cannot be transparently replayed.
              await recovery.recover(request);
            }
            throw error;
          } finally {
            close();
          }
        },
      };
    },
  };
}
