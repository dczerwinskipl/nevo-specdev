import type { AxiosInstance } from 'axios';

export type Awaitable<T> = T | Promise<T>;

export type HttpMethod = 'delete' | 'get' | 'head' | 'options' | 'patch' | 'post' | 'put';

export interface CredentialContext {
  readonly method: string;
  readonly url: string;
}

export interface ResolvedCredentials {
  readonly headers?: Readonly<Record<string, string>>;
  readonly includeCookies?: boolean;
}

export interface CredentialProvider {
  resolve(context: CredentialContext): Awaitable<ResolvedCredentials | undefined>;
}

export interface HttpClientOptions {
  readonly baseURL?: string;
  readonly timeoutMs?: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly credentials?: CredentialProvider;
  readonly allowAbsoluteUrls?: boolean;
}

export interface HttpTransportConfig<TParams = unknown> {
  readonly headers?: Readonly<Record<string, string>>;
  readonly params?: TParams;
  readonly signal?: AbortSignal;
}

export interface HttpRequestOptions<TParams = unknown> extends HttpTransportConfig<TParams> {
  readonly timeoutMs?: number;
}

export interface HttpRequestConfig<
  TBody = unknown,
  TParams = unknown,
> extends HttpRequestOptions<TParams> {
  readonly method: HttpMethod;
  readonly url: string;
  readonly body?: TBody;
}

export interface SseEvent {
  readonly type: string;
  readonly data: string;
  readonly id?: string;
}

export interface SseReconnectContext {
  readonly error?: unknown;
  readonly retryInMs: number;
}

export interface SseRequestConfig<
  TEvent = SseEvent,
  TParams = unknown,
> extends HttpTransportConfig<TParams> {
  readonly decode?: (event: SseEvent) => TEvent;
  readonly onConnected?: () => void;
  readonly onReconnecting?: (context: SseReconnectContext) => void;
}

export interface SseStream<TEvent> extends AsyncIterable<TEvent> {
  readonly lastEventId?: string;
  close(): void;
}

export interface HttpClient {
  readonly axios: AxiosInstance;

  request<TResponse = unknown, TBody = unknown, TParams = unknown>(
    config: HttpRequestConfig<TBody, TParams>,
  ): Promise<TResponse>;

  get<TResponse = unknown, TParams = unknown>(
    url: string,
    config?: HttpRequestOptions<TParams>,
  ): Promise<TResponse>;

  delete<TResponse = unknown, TParams = unknown>(
    url: string,
    config?: HttpRequestOptions<TParams>,
  ): Promise<TResponse>;

  post<TResponse = unknown, TBody = unknown, TParams = unknown>(
    url: string,
    body?: TBody,
    config?: HttpRequestOptions<TParams>,
  ): Promise<TResponse>;

  put<TResponse = unknown, TBody = unknown, TParams = unknown>(
    url: string,
    body?: TBody,
    config?: HttpRequestOptions<TParams>,
  ): Promise<TResponse>;

  patch<TResponse = unknown, TBody = unknown, TParams = unknown>(
    url: string,
    body?: TBody,
    config?: HttpRequestOptions<TParams>,
  ): Promise<TResponse>;

  sse<TEvent = SseEvent, TParams = unknown>(
    url: string,
    config?: SseRequestConfig<TEvent, TParams>,
  ): SseStream<TEvent>;
}

/** A transport-only interface for typed feature APIs. Does not expose raw Axios. */
export type HttpRequestClient = Omit<HttpClient, 'axios'>;
