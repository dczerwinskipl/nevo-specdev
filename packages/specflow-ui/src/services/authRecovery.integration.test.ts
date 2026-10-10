import {
  createHttpClient,
  HttpClientError,
  type SseEvent,
  type SseStream,
} from '@nevo/http-client';
import type { AuthSessionResponse } from '@nevo/specflow-contracts/authentication';
import { describe, expect, it, vi } from 'vitest';
import { AuthSessionSupersededError, createAuthStore } from '../auth/store';
import type { AuthApi } from '../auth/api';
import { createSpecFlowAppServices } from './index';
import { createProtectedRuntimeHttpClient } from './createProtectedRuntimeHttpClient';

const authenticated: AuthSessionResponse = {
  authenticationRequired: true,
  authenticated: true,
  user: { id: 'tester', name: 'Tester' },
  authenticatedWith: { kind: 'password' },
  loginMethods: { password: { enabled: true }, oidc: [] },
};
const unauthenticated: AuthSessionResponse = {
  authenticationRequired: true,
  authenticated: false,
  loginMethods: authenticated.loginMethods,
};
const trustedLocal: AuthSessionResponse = {
  authenticationRequired: false,
  authenticated: false,
  user: { id: 'local', name: 'Local' },
  loginMethods: { password: { enabled: false }, oidc: [] },
};
const unauthorized = () => new HttpClientError('Unauthorized', { kind: 'http', status: 401 });
const forbidden = () => new HttpClientError('Forbidden', { kind: 'http', status: 403 });

function setup(
  session: AuthSessionResponse = authenticated,
  revalidate: () => Promise<AuthSessionResponse> = () => Promise.resolve(authenticated),
  loginSession: AuthSessionResponse = authenticated,
) {
  const http = createHttpClient();
  const getSession = vi.fn(revalidate);
  const api: AuthApi = {
    getSession,
    loginWithPassword: () => Promise.resolve(loginSession),
    startOidc: () => Promise.reject(new Error('unused')),
    logout: () => Promise.resolve(),
  };
  const authStore = createAuthStore(api, session);
  const services = createSpecFlowAppServices({ http, authStore });
  const events: string[] = [];
  services.authRecovery.subscribe((result) => events.push(result));
  return { http, authStore, services, getSession, events };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
const otherUser: AuthSessionResponse = {
  ...authenticated,
  user: { id: 'other', name: 'Other User' },
};

describe('application-composed Runtime authentication recovery', () => {
  it('revalidates a still authenticated session and retries a Task read exactly once', async () => {
    const { http, services, getSession, events } = setup();
    const get = vi
      .spyOn(http, 'get')
      .mockRejectedValueOnce(unauthorized())
      .mockResolvedValueOnce({ task: { id: '1' } });
    await expect(services.taskApi.getTask('s', '1')).resolves.toEqual({ task: { id: '1' } });
    expect(get).toHaveBeenCalledTimes(2);
    expect(getSession).toHaveBeenCalledOnce();
    expect(events).toEqual([]);
  });

  it('routes an expired session through one application event without replaying GET', async () => {
    const { http, services, events, getSession } = setup(authenticated, () =>
      Promise.resolve(unauthenticated),
    );
    const get = vi.spyOn(http, 'get').mockRejectedValue(unauthorized());
    await expect(services.taskApi.getTask('s', '1')).rejects.toMatchObject({ status: 401 });
    expect(get).toHaveBeenCalledOnce();
    expect(getSession).toHaveBeenCalledOnce();
    expect(events).toEqual(['login']);
  });

  it('routes an unavailable authentication service to the dedicated recovery state', async () => {
    const { http, services, events } = setup(authenticated, () =>
      Promise.reject(new Error('offline')),
    );
    vi.spyOn(http, 'get').mockRejectedValue(unauthorized());
    await expect(services.specificationApi.getSpecificationWorkspace('s')).rejects.toMatchObject({
      status: 401,
    });
    expect(events).toEqual(['runtime-unavailable']);
  });

  it('coalesces concurrent 401 responses, including a late response from the previous generation', async () => {
    const { http, services, getSession } = setup();
    const get = vi
      .spyOn(http, 'get')
      .mockRejectedValueOnce(unauthorized())
      .mockRejectedValueOnce(unauthorized())
      .mockResolvedValue({ ok: true });
    await Promise.all([services.taskApi.getTask('s', '1'), services.taskApi.getTask('s', '2')]);
    expect(getSession).toHaveBeenCalledOnce();
    expect(get).toHaveBeenCalledTimes(4);
  });

  it('stops after one replay when 401 persists even with a valid session', async () => {
    const { http, services, getSession, events } = setup();
    const get = vi.spyOn(http, 'get').mockRejectedValue(unauthorized());
    await expect(services.taskApi.getTask('s', '1')).rejects.toMatchObject({ status: 401 });
    expect(get).toHaveBeenCalledTimes(2);
    expect(getSession).toHaveBeenCalledOnce();
    expect(events).toEqual([]);
  });

  it('keeps 403 resource denial distinct from session expiry', async () => {
    const { http, services, getSession, events } = setup();
    vi.spyOn(http, 'get').mockRejectedValue(forbidden());
    await expect(services.taskApi.getTask('s', '1')).rejects.toMatchObject({ status: 403 });
    expect(getSession).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it('does not automatically replay mutations after a 401', async () => {
    const { http, services, getSession } = setup();
    const post = vi.spyOn(http, 'post').mockRejectedValue(unauthorized());
    // New feature APIs inherit recovery from the application-composed protected transport.
    const protectedHttp = createProtectedRuntimeHttpClient(http, services.authRecovery);
    await expect(protectedHttp.post('/api/specs/s/actions', {})).rejects.toMatchObject({
      status: 401,
    });
    expect(post).toHaveBeenCalledOnce();
    expect(getSession).toHaveBeenCalledOnce();
  });

  it('trusted local mode never produces Login from a persistent 401', async () => {
    const { http, services, events } = setup(trustedLocal, () => Promise.resolve(trustedLocal));
    const get = vi.spyOn(http, 'get').mockRejectedValue(unauthorized());
    await expect(services.taskApi.getTask('s', '1')).rejects.toMatchObject({ status: 401 });
    expect(get).toHaveBeenCalledTimes(2);
    expect(events).toEqual([]);
  });

  it('session refresh preserves ready state and concurrent callers share the same request', async () => {
    const { authStore, getSession } = setup();
    const first = authStore.refresh();
    const second = authStore.refresh();
    expect(first).toBe(second);
    expect(authStore.getState().status).toBe('ready');
    await Promise.all([first, second]);
    expect(getSession).toHaveBeenCalledOnce();
  });

  it('ignores a superseded 401 refresh during logout without Runtime Unavailable redirect', async () => {
    const pending = deferred<AuthSessionResponse>();
    const started = deferred<void>();
    let sessionCalls = 0;
    const { http, services, authStore, events } = setup(authenticated, () => {
      sessionCalls += 1;
      if (sessionCalls === 1) {
        started.resolve();
        return pending.promise;
      }
      return Promise.resolve(unauthenticated);
    });
    const get = vi.spyOn(http, 'get').mockRejectedValue(unauthorized());

    const request = services.taskApi.getTask('s', '1');
    await started.promise;
    const logout = authStore.logout();
    pending.resolve(authenticated);
    await expect(request).rejects.toMatchObject({ status: 401 });
    await logout;

    expect(events).toEqual([]);
    expect(get).toHaveBeenCalledOnce();
    expect(authStore.getState()).toEqual({ status: 'ready', session: unauthenticated });
  });

  it('ignores stale 401 recovery when login switches account during refresh', async () => {
    const pending = deferred<AuthSessionResponse>();
    const started = deferred<void>();
    const { http, services, authStore, events } = setup(
      authenticated,
      () => {
        started.resolve();
        return pending.promise;
      },
      otherUser,
    );
    const get = vi.spyOn(http, 'get').mockRejectedValue(unauthorized());

    const request = services.taskApi.getTask('s', '1');
    await started.promise;
    await authStore.loginWithPassword('other', 'secret');
    pending.resolve(authenticated);
    await expect(request).rejects.toMatchObject({ status: 401 });

    expect(events).toEqual([]);
    expect(get).toHaveBeenCalledOnce();
    expect(authStore.getState()).toEqual({ status: 'ready', session: otherUser });
  });

  it('discards a late successful old-user response after switching identity', async () => {
    const pending = deferred<unknown>();
    const { http, services, authStore } = setup(authenticated, undefined, otherUser);
    vi.spyOn(http, 'get').mockImplementation(() => pending.promise);
    const request = services.taskApi.getTask('s', '1');

    await authStore.loginWithPassword('other', 'secret');
    pending.resolve({ task: { id: '1', title: 'Data from former user' } });
    await expect(request).rejects.toBeInstanceOf(AuthSessionSupersededError);
  });

  it('does not replay a request when session revalidation authenticates another principal', async () => {
    const { http, services, events } = setup(authenticated, () => Promise.resolve(otherUser));
    const get = vi.spyOn(http, 'get').mockRejectedValue(unauthorized());
    await expect(services.taskApi.getTask('s', '1')).rejects.toMatchObject({ status: 401 });
    expect(get).toHaveBeenCalledOnce();
    expect(events).toEqual([]);
  });

  it('a new identity never joins a pending refresh started by the old identity', async () => {
    const pending = deferred<AuthSessionResponse>();
    const started = deferred<void>();
    let sessionCalls = 0;
    const { http, services, authStore, events } = setup(
      authenticated,
      () => {
        sessionCalls += 1;
        if (sessionCalls === 1) {
          started.resolve();
          return pending.promise;
        }
        return Promise.resolve(otherUser);
      },
      otherUser,
    );
    const get = vi.spyOn(http, 'get').mockRejectedValue(unauthorized());

    const first = services.taskApi.getTask('s', '1');
    await started.promise;
    await authStore.loginWithPassword('other', 'secret');
    const second = services.taskApi.getTask('s', '2');
    pending.resolve(authenticated);
    await expect(first).rejects.toMatchObject({ status: 401 });
    await expect(second).rejects.toMatchObject({ status: 401 });

    expect(sessionCalls).toBe(2);
    expect(get).toHaveBeenCalledTimes(3); // one original for A, one original plus bounded retry for B
    expect(events).toEqual([]);
  });

  it('closes an active SSE stream immediately when another user logs in', async () => {
    const pending = deferred<SseEvent>();
    const { http, services, authStore, events } = setup(authenticated, undefined, otherUser);
    const close = vi.fn();
    const source: SseStream<SseEvent> = {
      close,
      async *[Symbol.asyncIterator]() {
        yield await pending.promise;
      },
    };
    vi.spyOn(http, 'sse').mockImplementation(() => source);
    const sse = createProtectedRuntimeHttpClient(http, services.authRecovery).sse('/api/events');
    const first = sse[Symbol.asyncIterator]().next();

    await authStore.loginWithPassword('other', 'secret');
    expect(close).toHaveBeenCalledOnce();
    pending.resolve({ type: 'message', data: 'private-user-a-event' });
    await expect(first).rejects.toBeInstanceOf(AuthSessionSupersededError);
    expect(events).toEqual([]);
  });

  it('rejects a late HTTP response after trusted-local auth changes', async () => {
    const localAuthenticated: AuthSessionResponse = {
      ...authenticated,
      authenticationRequired: false,
      user: { id: 'local', name: 'Local' },
    };
    const pending = deferred<unknown>();
    const nextSession = () => Promise.resolve(trustedLocal);
    const { http, services, authStore } = setup(localAuthenticated, nextSession);
    vi.spyOn(http, 'get').mockImplementation(() => pending.promise);
    const request = services.taskApi.getTask('s', 'task-a');
    const oldGeneration = authStore.sessionGeneration();

    await authStore.refresh();
    expect(authStore.sessionGeneration()).toBe(oldGeneration + 1);
    pending.resolve({ task: { id: 'task-a', title: 'Former auth context' } });

    await expect(request).rejects.toBeInstanceOf(AuthSessionSupersededError);
  });

  it('closes trusted-local SSE on auth changes without waiting for an event', async () => {
    const localAuthenticated: AuthSessionResponse = {
      ...authenticated,
      authenticationRequired: false,
      user: { id: 'local', name: 'Local' },
    };
    const pending = deferred<SseEvent>();
    const nextSession = () => Promise.resolve(trustedLocal);
    const { http, services, authStore } = setup(localAuthenticated, nextSession);
    const close = vi.fn();
    const source: SseStream<SseEvent> = {
      close,
      async *[Symbol.asyncIterator]() {
        yield await pending.promise;
      },
    };
    vi.spyOn(http, 'sse').mockImplementation(() => source);
    const stream = createProtectedRuntimeHttpClient(http, services.authRecovery).sse('/api/events');
    const next = stream[Symbol.asyncIterator]().next();

    await authStore.refresh();
    expect(close).toHaveBeenCalledOnce();
    pending.resolve({ type: 'message', data: 'former-context-event' });
    await expect(next).rejects.toBeInstanceOf(AuthSessionSupersededError);
  });

  it('actively closes an idle SSE stream on logout, without needing a new event', async () => {
    const pending = deferred<SseEvent>();
    const { http, services, authStore } = setup();
    const close = vi.fn();
    const source: SseStream<SseEvent> = {
      close,
      async *[Symbol.asyncIterator]() {
        yield await pending.promise;
      },
    };
    vi.spyOn(http, 'sse').mockImplementation(() => source);
    const sse = createProtectedRuntimeHttpClient(http, services.authRecovery).sse('/api/events');
    const next = sse[Symbol.asyncIterator]().next();
    await authStore.logout();
    expect(close).toHaveBeenCalledOnce();
    pending.resolve({ type: 'message', data: 'late-event' });
    await expect(next).rejects.toBeInstanceOf(AuthSessionSupersededError);
    sse.close();
    expect(close).toHaveBeenCalledOnce();
  });

  it('preserves legitimate SSE events and cleans up on normal stream completion', async () => {
    const { http, services } = setup();
    const close = vi.fn();
    const source: SseStream<SseEvent> = {
      close,
      async *[Symbol.asyncIterator]() {
        await Promise.resolve();
        yield { type: 'message', data: 'allowed' };
      },
    };
    vi.spyOn(http, 'sse').mockImplementation(() => source);
    const sse = createProtectedRuntimeHttpClient(http, services.authRecovery).sse('/api/events');
    const events: SseEvent[] = [];
    for await (const event of sse) events.push(event);
    expect(events).toEqual([{ type: 'message', data: 'allowed' }]);
    expect(close).toHaveBeenCalledOnce();
  });

  it('refuses to connect an SSE stream created before an identity change', async () => {
    const { http, services, authStore } = setup(authenticated, undefined, otherUser);
    const close = vi.fn();
    const source: SseStream<SseEvent> = {
      close,
      async *[Symbol.asyncIterator]() {
        await Promise.resolve();
        yield { type: 'message', data: 'must-not-deliver' };
      },
    };
    vi.spyOn(http, 'sse').mockImplementation(() => source);
    const sse = createProtectedRuntimeHttpClient(http, services.authRecovery).sse('/api/events');
    await authStore.loginWithPassword('other', 'secret');
    await expect(sse[Symbol.asyncIterator]().next()).rejects.toBeInstanceOf(
      AuthSessionSupersededError,
    );
    expect(close).toHaveBeenCalledOnce();
  });

  it('rejects a late A response and closes A SSE after refresh failure followed by B', async () => {
    const lateHttp = deferred<unknown>();
    const lateEvent = deferred<SseEvent>();
    let refreshCalls = 0;
    const { http, services, authStore, events } = setup(authenticated, () => {
      refreshCalls += 1;
      return refreshCalls === 1
        ? Promise.reject(new Error('temporary network outage'))
        : Promise.resolve(otherUser);
    });
    vi.spyOn(http, 'get').mockImplementation(() => lateHttp.promise);

    const close = vi.fn();
    const source: SseStream<SseEvent> = {
      close,
      async *[Symbol.asyncIterator]() {
        yield await lateEvent.promise;
      },
    };
    vi.spyOn(http, 'sse').mockImplementation(() => source);

    const request = services.taskApi.getTask('s', 'task-a');
    const sse = createProtectedRuntimeHttpClient(http, services.authRecovery).sse('/api/events');
    const nextEvent = sse[Symbol.asyncIterator]().next();
    const originalGeneration = authStore.sessionGeneration();

    await expect(authStore.refresh()).rejects.toThrow('temporary network outage');
    expect(authStore.getState().status).toBe('error');
    expect(close).not.toHaveBeenCalled();
    expect(authStore.sessionGeneration()).toBe(originalGeneration);

    await expect(authStore.refresh()).resolves.toEqual(otherUser);
    expect(authStore.sessionGeneration()).toBe(originalGeneration + 1);
    expect(close).toHaveBeenCalledOnce();

    lateHttp.resolve({ task: { id: 'task-a', title: 'Private data belonging to A' } });
    lateEvent.resolve({ type: 'message', data: 'Private event belonging to A' });
    await expect(request).rejects.toBeInstanceOf(AuthSessionSupersededError);
    await expect(nextEvent).rejects.toBeInstanceOf(AuthSessionSupersededError);
    expect(events).toEqual([]);
  });

  it('auth session endpoint errors do not recursively invoke protected recovery', async () => {
    const http = createHttpClient();
    const get = vi.spyOn(http, 'get').mockRejectedValue(unauthorized());
    const services = createSpecFlowAppServices({ http });
    await expect(services.authStore.refresh()).rejects.toMatchObject({ status: 401 });
    expect(get).toHaveBeenCalledTimes(1);
    expect(services.authRecovery.generation()).toBe(0);
  });
});
