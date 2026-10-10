import { QueryClient } from '@tanstack/react-query';
import type { AuthSessionResponse } from '@nevo/specflow-contracts/authentication';
import { describe, expect, it } from 'vitest';
import { createAuthStore } from '../auth/store';
import type { AuthApi } from '../auth/api';
import { bindAuthQueryCache } from './AuthQueryCacheBoundary';

const session = (id: string): AuthSessionResponse => ({
  authenticationRequired: true,
  authenticated: true,
  user: { id, name: id },
  authenticatedWith: { kind: 'password' },
  loginMethods: { password: { enabled: true }, oidc: [] },
});
const unauthenticated: AuthSessionResponse = {
  authenticationRequired: true,
  authenticated: false,
  loginMethods: session('a').loginMethods,
};

function setup(
  getSession: () => Promise<AuthSessionResponse>,
  initialSession: AuthSessionResponse = session('a'),
) {
  const api: AuthApi = {
    getSession,
    loginWithPassword: (_username) => Promise.resolve(session('b')),
    startOidc: () => Promise.reject(new Error('unused')),
    logout: () => Promise.resolve(),
  };
  const auth = createAuthStore(api, initialSession);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const detach = bindAuthQueryCache(auth, queryClient);
  const key = ['specifications', 'a', 'document', 'notes'];
  queryClient.setQueryData(key, { data: 'private' });
  return { auth, queryClient, detach, key };
}

describe('Auth Query cache isolation', () => {
  it('retains feature data while revalidating the same confirmed identity', async () => {
    const { auth, queryClient, detach, key } = setup(() => Promise.resolve(session('a')));
    const refresh = auth.refresh();
    expect(queryClient.getQueryData(key)).toEqual({ data: 'private' });
    await refresh;
    expect(queryClient.getQueryData(key)).toEqual({ data: 'private' });
    detach();
  });

  it('clears prior-user data after a genuine identity change', async () => {
    const { auth, queryClient, detach, key } = setup(() => Promise.resolve(session('a')));
    await auth.loginWithPassword('b', 'secret');
    expect(queryClient.getQueryData(key)).toBeUndefined();
    detach();
  });

  it('clears cached user data when a trusted-local session stops being authenticated', async () => {
    const initiallyAuthenticated: AuthSessionResponse = {
      ...session('a'),
      authenticationRequired: false,
    };
    const revalidated: AuthSessionResponse = {
      authenticationRequired: false,
      authenticated: false,
      user: { id: 'a', name: 'a' },
      loginMethods: session('a').loginMethods,
    };
    const { auth, queryClient, detach, key } = setup(
      () => Promise.resolve(revalidated),
      initiallyAuthenticated,
    );
    await auth.refresh();
    expect(auth.sessionGeneration()).toBe(1);
    expect(queryClient.getQueryData(key)).toBeUndefined();
    detach();
  });

  it('retains cached data when revalidating the same trusted-local user', async () => {
    const localSession: AuthSessionResponse = {
      authenticationRequired: false,
      authenticated: false,
      user: { id: 'a', name: 'a' },
      loginMethods: session('a').loginMethods,
    };
    const { auth, queryClient, detach, key } = setup(
      () => Promise.resolve(localSession),
      localSession,
    );
    await auth.refresh();
    expect(queryClient.getQueryData(key)).toEqual({ data: 'private' });
    detach();
  });

  it('clears cache as soon as explicit logout begins', async () => {
    const { auth, queryClient, detach, key } = setup(() => Promise.resolve(unauthenticated));
    const operation = auth.logout();
    expect(queryClient.getQueryData(key)).toBeUndefined();
    await operation;
    detach();
  });

  it('does not classify a temporarily unavailable authentication service as a new identity', async () => {
    const { auth, queryClient, detach, key } = setup(() => Promise.reject(new Error('offline')));
    await expect(auth.refresh()).rejects.toThrow('offline');
    expect(queryClient.getQueryData(key)).toEqual({ data: 'private' });
    detach();
  });
});
