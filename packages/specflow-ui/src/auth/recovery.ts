import { AuthSessionSupersededError, type AuthStore } from './store';

export type RecoveryResult = 'retry' | 'login' | 'runtime-unavailable' | 'superseded';

export interface RecoverySnapshot {
  readonly recoveryGeneration: number;
  readonly sessionGeneration: number;
  readonly mutationGeneration: number;
}

export interface AuthRecoveryCoordinator {
  generation(): number;
  snapshot(): RecoverySnapshot;
  isCurrent(snapshot: RecoverySnapshot): boolean;
  recover(snapshot: RecoverySnapshot): Promise<RecoveryResult>;
  subscribe(listener: (result: 'login' | 'runtime-unavailable') => void): () => void;
  /** Invalidate long-lived streams as soon as their original principal changes. */
  subscribeInvalidation(snapshot: RecoverySnapshot, listener: () => void): () => void;
}

/** One session-scoped recovery for all protected Runtime feature reads. */
export function createAuthRecoveryCoordinator(auth: AuthStore): AuthRecoveryCoordinator {
  let generation = 0;
  let pending: Promise<RecoveryResult> | undefined;
  let pendingSessionGeneration = -1;
  let lastResult: RecoveryResult = 'retry';
  let blocked = false;
  const listeners = new Set<(result: 'login' | 'runtime-unavailable') => void>();

  auth.subscribe(() => {
    if (!blocked) return;
    const state = auth.getState();
    if (
      state.status === 'ready' &&
      (!state.session.authenticationRequired || state.session.authenticated)
    ) {
      blocked = false;
      lastResult = 'retry';
      generation += 1;
    }
  });

  const snapshot = (): RecoverySnapshot => ({
    recoveryGeneration: generation,
    sessionGeneration: auth.sessionGeneration(),
    mutationGeneration: auth.mutationGeneration(),
  });
  const isCurrent = (request: RecoverySnapshot) =>
    request.sessionGeneration === auth.sessionGeneration() &&
    request.mutationGeneration === auth.mutationGeneration();

  const report = (result: RecoveryResult) => {
    if (result !== 'login' && result !== 'runtime-unavailable') return;
    for (const listener of listeners) listener(result);
  };

  return {
    generation: () => generation,
    snapshot,
    isCurrent,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    subscribeInvalidation(request, listener) {
      return auth.subscribe(() => {
        if (!isCurrent(request)) listener();
      });
    },
    recover(request) {
      if (!isCurrent(request)) return Promise.resolve('superseded');
      if (request.recoveryGeneration < generation || blocked) return Promise.resolve(lastResult);
      // A new logged-in identity must not join a refresh from an older session.
      if (pending && pendingSessionGeneration === request.sessionGeneration) return pending;

      const requestPromise = auth
        .refresh()
        .then(
          (session): RecoveryResult => {
            if (request.mutationGeneration !== auth.mutationGeneration()) return 'superseded';
            if (session.authenticationRequired && !session.authenticated) return 'login';
            return isCurrent(request) ? 'retry' : 'superseded';
          },
          (error: unknown): RecoveryResult =>
            error instanceof AuthSessionSupersededError ||
            request.mutationGeneration !== auth.mutationGeneration()
              ? 'superseded'
              : 'runtime-unavailable',
        )
        .then((result) => {
          if (result === 'superseded' || request.mutationGeneration !== auth.mutationGeneration()) {
            return 'superseded';
          }
          generation += 1;
          lastResult = result;
          blocked = result !== 'retry';
          report(result);
          return result;
        })
        .finally(() => {
          if (pending === requestPromise) pending = undefined;
        });
      pending = requestPromise;
      pendingSessionGeneration = request.sessionGeneration;
      return requestPromise;
    },
  };
}
