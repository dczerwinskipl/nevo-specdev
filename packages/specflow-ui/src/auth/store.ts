import type { AuthSessionResponse } from '@nevo/specflow-contracts/authentication';

import type { AuthApi } from './api';

export type AuthStoreState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading'; readonly reason?: 'bootstrap' | 'logout' }
  | { readonly status: 'ready'; readonly session: AuthSessionResponse }
  | { readonly status: 'error'; readonly error: unknown };

export class AuthSessionSupersededError extends Error {
  constructor() {
    super('Session revalidation superseded by an authentication transition.');
    this.name = 'AuthSessionSupersededError';
  }
}
/**
 * Canonical protected-data identity: cache invalidation and in-flight HTTP/SSE
 * lifetimes must agree even when local mode toggles its authenticated state.
 */
export function authSessionIdentity(session: AuthSessionResponse): string {
  const mode = session.authenticationRequired ? 'required' : 'trusted-local';
  const principal = session.authenticated
    ? `user:${session.user.id}`
    : `anonymous:${session.user?.id ?? 'local'}`;
  return `${mode}:${session.authenticated ? 'authenticated' : 'unauthenticated'}:${principal}`;
}

export interface AuthStore {
  sessionGeneration(): number;
  mutationGeneration(): number;
  getState(): AuthStoreState;
  subscribe(listener: () => void): () => void;
  ensureSession(): Promise<AuthSessionResponse>;
  refresh(): Promise<AuthSessionResponse>;
  loginWithPassword(username: string, password: string): Promise<AuthSessionResponse>;
  startOidc(providerId: string, returnTo: string): Promise<string>;
  logout(): Promise<void>;
}

export function createAuthStore(api: AuthApi, initialSession?: AuthSessionResponse): AuthStore {
  let state: AuthStoreState = initialSession
    ? { status: 'ready', session: initialSession }
    : { status: 'idle' };
  let pending: Promise<AuthSessionResponse> | undefined;
  let pendingMutation = -1;
  let pendingLogout: Promise<AuthSessionResponse> | undefined;
  let logoutMutation = -1;
  let explicitMutation = 0;
  let sessionEpoch = 0;
  // Preserve the last confirmed principal across transient loading/error states.
  let confirmedIdentity = initialSession ? authSessionIdentity(initialSession) : undefined;
  const listeners = new Set<() => void>();

  const setState = (next: AuthStoreState) => {
    state = next;
    for (const listener of listeners) listener();
  };

  const confirmSession = (session: AuthSessionResponse, mutationAlreadyAdvanced = false) => {
    const nextIdentity = authSessionIdentity(session);
    if (
      !mutationAlreadyAdvanced &&
      confirmedIdentity !== undefined &&
      confirmedIdentity !== nextIdentity
    ) {
      sessionEpoch += 1;
    }
    confirmedIdentity = nextIdentity;
    setState({ status: 'ready', session });
  };

  const load = (force: boolean): Promise<AuthSessionResponse> => {
    // A route guard must never fetch an old authenticated session while logout runs.
    if (pendingLogout && logoutMutation === explicitMutation) return pendingLogout;
    // Do not join a stale revalidation started before login/logout.
    if (pending && pendingMutation === explicitMutation) return pending;
    if (!force && state.status === 'ready') return Promise.resolve(state.session);

    if (state.status !== 'ready') setState({ status: 'loading', reason: 'bootstrap' });
    const generation = explicitMutation;
    const request = api
      .getSession()
      .then((session) => {
        if (generation !== explicitMutation) throw new AuthSessionSupersededError();
        confirmSession(session);
        return session;
      })
      .catch((error: unknown) => {
        if (generation !== explicitMutation) throw new AuthSessionSupersededError();
        setState({ status: 'error', error });
        throw error;
      })
      .finally(() => {
        if (pending === request) pending = undefined;
      });
    pending = request;
    pendingMutation = generation;
    return request;
  };

  return {
    getState: () => state,
    sessionGeneration: () => sessionEpoch,
    mutationGeneration: () => explicitMutation,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    ensureSession: () => load(false),
    refresh: () => load(true),
    async loginWithPassword(username, password) {
      const generation = ++explicitMutation;
      sessionEpoch += 1;
      const session = await api.loginWithPassword({ username, password });
      if (generation === explicitMutation) confirmSession(session, true);
      return session;
    },
    async startOidc(providerId, returnTo) {
      const result = await api.startOidc(providerId, returnTo);
      return result.authorizationUrl;
    },
    async logout() {
      const generation = ++explicitMutation;
      sessionEpoch += 1;
      setState({ status: 'loading', reason: 'logout' });
      const operation = api
        .logout()
        .then(() => api.getSession())
        .then((session) => {
          if (generation === explicitMutation) confirmSession(session, true);
          return session;
        })
        .catch((error: unknown) => {
          if (generation === explicitMutation) setState({ status: 'error', error });
          throw error;
        })
        .finally(() => {
          if (pendingLogout === operation) pendingLogout = undefined;
        });
      pendingLogout = operation;
      logoutMutation = generation;
      await operation;
    },
  };
}
