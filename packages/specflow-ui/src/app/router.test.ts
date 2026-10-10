import type { AuthSessionResponse } from '@nevo/specflow-contracts/authentication';
import { describe, expect, it } from 'vitest';
import { createMemoryHistory, isRedirect } from '@tanstack/react-router';

import type { AuthApi } from '../auth/api';
import { createAuthStore } from '../auth/store';
import { createSpecsFixture } from '../../test-support/specs/overview/fixtures';
import { createSpecFlowAppServices } from '../services';
import {
  createSpecFlowRouter,
  resolveAppAccess,
  resolveLoginAccess,
  validateSpecificationSearch,
  specificationRoute,
} from './router';

const noAuth: AuthSessionResponse = {
  authenticationRequired: false,
  authenticated: false,
  user: { id: 'local-user', name: 'Local User' },
  loginMethods: { password: { enabled: false }, oidc: [] },
};

const loginRequired: AuthSessionResponse = {
  authenticationRequired: true,
  authenticated: false,
  loginMethods: { password: { enabled: true }, oidc: [] },
};

const authenticated: AuthSessionResponse = {
  authenticationRequired: true,
  authenticated: true,
  user: { id: 'demo', name: 'Demo' },
  authenticatedWith: { kind: 'password' },
  loginMethods: { password: { enabled: true }, oidc: [] },
};

describe('SpecFlow router access policy', () => {
  it.each(['current', 'archive'] as const)(
    'reaches the owned Specification directly and preserves the %s collection identifier',
    async (collection) => {
      const router = createSpecFlowRouter(
        createMemoryHistory({ initialEntries: [`/specs/admission?collection=${collection}`] }),
        createSpecFlowAppServices({
          authStore: storeWith(authenticated),
          specsOverviewApi: { getOverview: (value) => Promise.resolve(createSpecsFixture(value)) },
        }),
      );
      await router.load();
      const match = router.state.matches.find((item) => item.routeId === '/_app/specs/$specId');
      expect(match?.status).toBe('success');
      expect(match?.params).toEqual({ specId: 'admission' });
      expect(match?.search).toEqual({ collection });
    },
  );

  it.each(['current', 'archive'] as const)(
    'reaches Full Task directly by stable Task ID (%s) without Workspace state',
    async (collection) => {
      const router = createSpecFlowRouter(
        createMemoryHistory({
          initialEntries: [`/specs/admission/tasks/TASK-77?collection=${collection}`],
        }),
        createSpecFlowAppServices({
          authStore: storeWith(authenticated),
          specsOverviewApi: { getOverview: (value) => Promise.resolve(createSpecsFixture(value)) },
        }),
      );
      await router.load();
      const match = router.state.matches.find(
        (item) => item.routeId === '/_app/specs/$specId/tasks/$taskId',
      );
      expect(match?.status).toBe('success');
      expect(match?.params).toEqual({ specId: 'admission', taskId: 'TASK-77' });
      expect(match?.search).toEqual({ collection });
    },
  );

  it('redirects legacy Task search state to the canonical resource route', () => {
    const beforeLoad = specificationRoute.options.beforeLoad;
    expect(beforeLoad).toBeDefined();
    const result: unknown = beforeLoad?.({
      params: { specId: 'admission' },
      search: { collection: 'archive', view: 'task', task: 'TASK-03' },
    } as Parameters<NonNullable<typeof beforeLoad>>[0]);
    expect(isRedirect(result)).toBe(true);
    if (isRedirect(result)) {
      expect(result.options.to).toBe('/specs/$specId/tasks/$taskId');
      expect(result.options.params).toEqual({ specId: 'admission', taskId: 'TASK-03' });
      expect(result.options.search).toEqual({ collection: 'archive' });
    }
  });

  it('redirects the legacy Documents tab to the canonical Primary URL', () => {
    const beforeLoad = specificationRoute.options.beforeLoad;
    const result: unknown = beforeLoad?.({
      params: { specId: 'admission' },
      search: { collection: 'current', view: 'documents' },
    } as Parameters<NonNullable<typeof beforeLoad>>[0]);
    expect(isRedirect(result)).toBe(true);
    if (isRedirect(result)) {
      expect(result.options.to).toBe('/specs/$specId/documents');
      expect(result.options.params).toEqual({ specId: 'admission' });
      expect(result.options.search).toEqual({ collection: 'current' });
      expect(result.options.replace).toBe(true);
    }
  });

  it('normalizes search parameters: strips task when view is documents', () => {
    const validated = validateSpecificationSearch({
      collection: 'current',
      view: 'documents',
      task: 'TASK-03',
    });
    expect(validated).toEqual({ collection: 'current', view: 'documents' });
  });

  it('normalizes search parameters: sets view=task when task is present without view', () => {
    const validated = validateSpecificationSearch({
      task: 'TASK-03',
    });
    expect(validated).toEqual({ collection: 'current', view: 'task', task: 'TASK-03' });
  });

  it('normalizes search parameters: allows view=task without task id', () => {
    const validated = validateSpecificationSearch({
      view: 'task',
    });
    expect(validated).toEqual({ collection: 'current', view: 'task' });
  });

  it('preserves a Full Task deep link through authentication', async () => {
    const returnTo = '/specs/admission/tasks/TASK-77?collection=archive';
    await expect(resolveAppAccess(storeWith(loginRequired), returnTo)).resolves.toEqual({
      kind: 'login',
      returnTo,
    });
    await expect(resolveLoginAccess(storeWith(authenticated), returnTo)).resolves.toEqual({
      kind: 'app',
      returnTo,
    });
  });

  it('preserves the Specification deep link through authentication', async () => {
    const returnTo = '/specs/admission?collection=archive';
    await expect(resolveAppAccess(storeWith(loginRequired), returnTo)).resolves.toEqual({
      kind: 'login',
      returnTo,
    });
    await expect(resolveLoginAccess(storeWith(authenticated), returnTo)).resolves.toEqual({
      kind: 'app',
      returnTo,
    });
  });

  it('allows trusted local mode into app routes without a login screen', async () => {
    await expect(resolveAppAccess(storeWith(noAuth), '/ui-playground')).resolves.toEqual({
      kind: 'allow',
    });
  });

  it('redirects required unauthenticated app access to login and preserves a safe returnTo', async () => {
    await expect(resolveAppAccess(storeWith(loginRequired), '/ui-playground')).resolves.toEqual({
      kind: 'login',
      returnTo: '/ui-playground',
    });

    await expect(resolveAppAccess(storeWith(loginRequired), '//evil.example')).resolves.toEqual({
      kind: 'login',
      returnTo: '/',
    });
  });

  it('redirects an authenticated login route back into the application', async () => {
    await expect(resolveLoginAccess(storeWith(authenticated), '/ui-playground')).resolves.toEqual({
      kind: 'app',
      returnTo: '/ui-playground',
    });
  });

  it('redirects local-mode login visits back into the application', async () => {
    await expect(resolveLoginAccess(storeWith(noAuth), undefined)).resolves.toEqual({
      kind: 'app',
      returnTo: '/',
    });
  });

  it('keeps required unauthenticated users on the login route', async () => {
    await expect(resolveLoginAccess(storeWith(loginRequired), '/')).resolves.toEqual({
      kind: 'allow',
    });
  });

  it('routes Runtime bootstrap failure to a standalone recovery state', async () => {
    const auth = createAuthStore(
      fakeApi({ getSession: () => Promise.reject(new Error('runtime down')) }),
    );

    await expect(resolveAppAccess(auth, '/ui-playground')).resolves.toEqual({
      kind: 'runtime-unavailable',
      returnTo: '/ui-playground',
    });
    await expect(resolveLoginAccess(auth, '/ui-playground')).resolves.toEqual({
      kind: 'runtime-unavailable',
      returnTo: '/ui-playground',
    });
  });
});

function storeWith(session: AuthSessionResponse) {
  return createAuthStore(fakeApi(), session);
}

function fakeApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    getSession: () => Promise.resolve(noAuth),
    loginWithPassword: () => Promise.reject(new Error('not configured')),
    startOidc: () => Promise.reject(new Error('not configured')),
    logout: () => Promise.resolve(),
    ...overrides,
  };
}
