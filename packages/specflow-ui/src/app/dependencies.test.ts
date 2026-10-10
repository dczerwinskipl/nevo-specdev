import { createHttpClient } from '@nevo/http-client';
import type { AuthSessionResponse } from '@nevo/specflow-contracts/authentication';
import { describe, expect, it, vi } from 'vitest';

import { createSpecsFixture } from '../../test-support/specs/overview/fixtures';
import { createSpecFlowAppServices } from './dependencies';

const localSession: AuthSessionResponse = {
  authenticationRequired: false,
  authenticated: false,
  user: { id: 'local-user', name: 'Local User' },
  loginMethods: { password: { enabled: false }, oidc: [] },
};

describe('SpecFlow application services', () => {
  it('composes auth and feature data access from the same application HTTP client', async () => {
    const client = createHttpClient();
    const projection = createSpecsFixture('archive');
    const get = vi
      .spyOn(client, 'get')
      .mockResolvedValueOnce(localSession)
      .mockResolvedValueOnce(projection);

    const services = createSpecFlowAppServices(client);
    const signal = new AbortController().signal;

    await expect(services.authStore.ensureSession()).resolves.toEqual(localSession);
    await expect(services.specsOverviewApi.getOverview('archive', signal)).resolves.toEqual(
      projection,
    );

    expect(get).toHaveBeenNthCalledWith(1, '/api/auth/session');
    expect(get).toHaveBeenNthCalledWith(2, '/api/specs/overview', {
      params: { collection: 'archive' },
      signal,
    });
  });
});
