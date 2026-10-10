import type { AuthSessionResponse } from '@nevo/specflow-contracts/authentication';
import { describe, expect, it } from 'vitest';

import type { AuthApi } from './api';
import { authSessionIdentity, createAuthStore } from './store';

const anonymous: AuthSessionResponse = {
  authenticationRequired: true,
  authenticated: false,
  loginMethods: {
    password: { enabled: true },
    oidc: [{ id: 'company', name: 'Company SSO' }],
  },
};

describe('AuthStore', () => {
  it('invalidates same-user trusted-local auth transitions', async () => {
    const localAuthenticated: AuthSessionResponse = {
      authenticationRequired: false,
      authenticated: true,
      user: { id: 'local', name: 'Local' },
      authenticatedWith: { kind: 'password' },
      loginMethods: anonymous.loginMethods,
    };
    const localUnauthenticated: AuthSessionResponse = {
      authenticationRequired: false,
      authenticated: false,
      user: { id: 'local', name: 'Local' },
      loginMethods: anonymous.loginMethods,
    };
    expect(authSessionIdentity(localAuthenticated)).not.toBe(
      authSessionIdentity(localUnauthenticated),
    );

    const store = createAuthStore(
      fakeApi({ getSession: () => Promise.resolve(localUnauthenticated) }),
      localAuthenticated,
    );
    const before = store.sessionGeneration();
    await store.refresh();
    expect(store.sessionGeneration()).toBe(before + 1);
    await store.refresh();
    expect(store.sessionGeneration()).toBe(before + 1);
  });

  it('invalidates a mode transition for the same user', async () => {
    const required: AuthSessionResponse = {
      authenticationRequired: true,
      authenticated: true,
      user: { id: 'local', name: 'Local' },
      authenticatedWith: { kind: 'password' },
      loginMethods: anonymous.loginMethods,
    };
    const trusted = { ...required, authenticationRequired: false };
    const store = createAuthStore(
      fakeApi({ getSession: () => Promise.resolve(trusted) }),
      required,
    );
    await store.refresh();
    expect(store.sessionGeneration()).toBe(1);
  });

  it('coalesces bootstrap requests and publishes the loaded session', async () => {
    let calls = 0;
    const api = fakeApi({
      getSession: () => {
        calls += 1;
        return Promise.resolve(anonymous);
      },
    });
    const store = createAuthStore(api);

    const [first, second] = await Promise.all([store.ensureSession(), store.ensureSession()]);

    expect(calls).toBe(1);
    expect(first).toEqual(anonymous);
    expect(second).toEqual(anonymous);
    expect(store.getState()).toEqual({ status: 'ready', session: anonymous });
  });

  it('updates the shared session after password login', async () => {
    const authenticated: AuthSessionResponse = {
      authenticationRequired: true,
      authenticated: true,
      user: { id: 'demo', name: 'Demo' },
      authenticatedWith: { kind: 'password' },
      loginMethods: anonymous.loginMethods,
    };
    const store = createAuthStore(
      fakeApi({ loginWithPassword: () => Promise.resolve(authenticated) }),
      anonymous,
    );

    await store.loginWithPassword('demo', 'secret');

    expect(store.getState()).toEqual({ status: 'ready', session: authenticated });
  });

  it('refreshes the shared session after Runtime logout succeeds', async () => {
    const calls: string[] = [];
    const authenticated: AuthSessionResponse = {
      authenticationRequired: true,
      authenticated: true,
      user: { id: 'demo', name: 'Demo' },
      authenticatedWith: { kind: 'password' },
      loginMethods: anonymous.loginMethods,
    };
    const store = createAuthStore(
      fakeApi({
        logout: () => {
          calls.push('logout');
          return Promise.resolve();
        },
        getSession: () => {
          calls.push('getSession');
          return Promise.resolve(anonymous);
        },
      }),
      authenticated,
    );

    await store.logout();

    expect(calls).toEqual(['logout', 'getSession']);
    expect(store.getState()).toEqual({ status: 'ready', session: anonymous });
  });

  it('guards session reads until in-flight logout finishes', async () => {
    let finishLogout!: () => void;
    const logoutGate = new Promise<void>((resolve) => {
      finishLogout = resolve;
    });
    const authenticated: AuthSessionResponse = {
      authenticationRequired: true,
      authenticated: true,
      user: { id: 'demo', name: 'Demo' },
      authenticatedWith: { kind: 'password' },
      loginMethods: anonymous.loginMethods,
    };
    let reads = 0;
    const store = createAuthStore(
      fakeApi({
        logout: () => logoutGate,
        getSession: () => {
          reads += 1;
          return Promise.resolve(anonymous);
        },
      }),
      authenticated,
    );

    const logout = store.logout();
    const routeGuard = store.ensureSession();
    expect(reads).toBe(0);
    finishLogout();
    await logout;
    await expect(routeGuard).resolves.toEqual(anonymous);
    expect(reads).toBe(1);
    expect(store.getState()).toEqual({ status: 'ready', session: anonymous });
  });

  it('tracks identity changes after refresh failure without resetting the confirmed principal', async () => {
    const userA: AuthSessionResponse = {
      authenticationRequired: true,
      authenticated: true,
      user: { id: 'a', name: 'User A' },
      authenticatedWith: { kind: 'password' },
      loginMethods: anonymous.loginMethods,
    };
    const userB: AuthSessionResponse = {
      ...userA,
      user: { id: 'b', name: 'User B' },
    };
    let refreshCount = 0;
    const store = createAuthStore(
      fakeApi({
        getSession: () => {
          refreshCount += 1;
          return refreshCount === 1
            ? Promise.reject(new Error('network unavailable'))
            : Promise.resolve(userB);
        },
      }),
      userA,
    );

    const originalGeneration = store.sessionGeneration();
    await expect(store.refresh()).rejects.toThrow('network unavailable');
    expect(store.getState().status).toBe('error');
    expect(store.sessionGeneration()).toBe(originalGeneration);

    await expect(store.refresh()).resolves.toEqual(userB);
    expect(store.sessionGeneration()).toBe(originalGeneration + 1);
    expect(store.getState()).toEqual({ status: 'ready', session: userB });

    await store.refresh();
    expect(store.sessionGeneration()).toBe(originalGeneration + 1);
  });

  it('does not double-invalidate when revalidating after an explicit login', async () => {
    const userB: AuthSessionResponse = {
      authenticationRequired: true,
      authenticated: true,
      user: { id: 'b', name: 'User B' },
      authenticatedWith: { kind: 'password' },
      loginMethods: anonymous.loginMethods,
    };
    const store = createAuthStore(
      fakeApi({
        loginWithPassword: () => Promise.resolve(userB),
        getSession: () => Promise.resolve(userB),
      }),
      anonymous,
    );

    await store.loginWithPassword('b', 'secret');
    const generationAfterLogin = store.sessionGeneration();
    await store.refresh();
    expect(store.sessionGeneration()).toBe(generationAfterLogin);
  });

  it('surfaces a failed post-logout session refresh as an auth-store error', async () => {
    const runtimeError = new Error('runtime unavailable');
    const store = createAuthStore(
      fakeApi({
        getSession: () => Promise.reject(runtimeError),
        logout: () => Promise.resolve(),
      }),
      {
        authenticationRequired: true,
        authenticated: true,
        user: { id: 'demo', name: 'Demo' },
        authenticatedWith: { kind: 'password' },
        loginMethods: anonymous.loginMethods,
      },
    );

    await expect(store.logout()).rejects.toBe(runtimeError);
    expect(store.getState()).toEqual({ status: 'error', error: runtimeError });
  });
});

function fakeApi(overrides: Partial<AuthApi>): AuthApi {
  return {
    getSession: () => Promise.resolve(anonymous),
    loginWithPassword: () => Promise.reject(new Error('not configured')),
    startOidc: () => Promise.reject(new Error('not configured')),
    logout: () => Promise.resolve(),
    ...overrides,
  };
}
