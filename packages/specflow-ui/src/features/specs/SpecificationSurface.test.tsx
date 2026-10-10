import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { appI18n, LocalizationProvider } from '../../i18n';
import { createSpecFlowQueryClient } from '../../app/queryClient';
import { builtInUiModuleRegistry } from '../../app/ui-modules/builtInUiModules';
import { UiModulesProvider } from '../../app/ui-modules/UiModulesProvider';
import { createSpecFlowAppServices } from '../../services';
import { TestServicesRouterContext } from '../../../test-support/app/TestServicesRouterContext';
import { SpecificationSurface } from './SpecificationSurface';
import { HttpClientError } from '@nevo/http-client';
import { specificationKeys } from './queries';
import { createSpecificationWorkspaceFixture } from '../../../test-support/specs/workspace/fixtures';

import { AppShell } from '@nevo/ui';

describe('SpecificationSurface', () => {
  beforeEach(async () => {
    await appI18n.changeLanguage('pl');
  });

  function renderWithProviders(
    component: React.ReactElement,
    servicesOverride?: Parameters<typeof createSpecFlowAppServices>[0],
  ) {
    const queryClient = createSpecFlowQueryClient();
    const services = createSpecFlowAppServices(servicesOverride);
    return renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <UiModulesProvider modules={builtInUiModuleRegistry}>
          <TestServicesRouterContext services={services}>
            <LocalizationProvider>
              <AppShell navigation={<div>Nav</div>}>{component}</AppShell>
            </LocalizationProvider>
          </TestServicesRouterContext>
        </UiModulesProvider>
      </QueryClientProvider>,
    );
  }

  it('renders explicit data fixture directly without queryClient execution', () => {
    const fixtureData = createSpecificationWorkspaceFixture('working', 'spec-direct');
    const markup = renderWithProviders(
      <SpecificationSurface specId="spec-direct" data={fixtureData} />,
    );

    expect(markup).toContain('Odświeżanie sesji i zachowanie kontekstu użytkownika');
    expect(markup).toContain('ID specyfikacji: spec-direct');
  });

  it('shows loading state on initial fetch without preloaded data', () => {
    const markup = renderWithProviders(<SpecificationSurface specId="spec-missing" />);

    // Initial query state is loading, not fixture domain data
    expect(markup).not.toContain('Odświeżanie sesji i zachowanie kontekstu użytkownika');
    expect(markup).toContain('Ładowanie specyfikacji spec-missing');
  });

  it('shows honest unavailable state when specification API fails / capability is missing', () => {
    const queryClient = createSpecFlowQueryClient();
    const services = createSpecFlowAppServices();
    const query = queryClient.getQueryCache().build(queryClient, {
      queryKey: specificationKeys.detail('spec-missing'),
    });
    query.setState({
      status: 'error',
      error: new HttpClientError('Unavailable', {
        kind: 'http',
        status: 503,
        data: { error: 'specification_source_unavailable' },
      }),
      fetchStatus: 'idle',
      errorUpdateCount: 1,
    });

    const markup = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <UiModulesProvider modules={builtInUiModuleRegistry}>
          <TestServicesRouterContext services={services}>
            <LocalizationProvider>
              <AppShell navigation={<div>Nav</div>}>
                <SpecificationSurface specId="spec-missing" />
              </AppShell>
            </LocalizationProvider>
          </TestServicesRouterContext>
        </UiModulesProvider>
      </QueryClientProvider>,
    );

    // Shows honest unavailable state, not false 404 "not found"
    expect(markup).toContain('Specyfikacja jest niedostępna');
    expect(markup).not.toContain('Nie znaleziono specyfikacji');
  });

  it('renders genuine not found only when API returns 404 domain error', () => {
    const queryClient = createSpecFlowQueryClient();
    const domainNotFoundError = new HttpClientError('Not found', {
      kind: 'http',
      status: 404,
      data: { error: 'specification_not_found' },
    });

    const services = createSpecFlowAppServices();
    const query = queryClient.getQueryCache().build(queryClient, {
      queryKey: specificationKeys.detail('spec-404'),
    });
    query.setState({
      status: 'error',
      error: domainNotFoundError,
      fetchStatus: 'idle',
      errorUpdateCount: 1,
    });

    const markup = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <UiModulesProvider modules={builtInUiModuleRegistry}>
          <TestServicesRouterContext services={services}>
            <LocalizationProvider>
              <AppShell navigation={<div>Nav</div>}>
                <SpecificationSurface specId="spec-404" />
              </AppShell>
            </LocalizationProvider>
          </TestServicesRouterContext>
        </UiModulesProvider>
      </QueryClientProvider>,
    );

    expect(markup).toContain('Nie znaleziono specyfikacji');
  });

  it('renders seeded presentation data in isolated component tests', () => {
    const queryClient = createSpecFlowQueryClient();
    const services = createSpecFlowAppServices();

    queryClient.setQueryData(
      specificationKeys.detail('spec-123'),
      createSpecificationWorkspaceFixture('working', 'spec-123'),
    );

    const markup = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <UiModulesProvider modules={builtInUiModuleRegistry}>
          <TestServicesRouterContext services={services}>
            <LocalizationProvider>
              <AppShell navigation={<div>Nav</div>}>
                <SpecificationSurface specId="spec-123" />
              </AppShell>
            </LocalizationProvider>
          </TestServicesRouterContext>
        </UiModulesProvider>
      </QueryClientProvider>,
    );

    expect(markup).toContain('Odświeżanie sesji i zachowanie kontekstu użytkownika');
    expect(markup).toContain('ID specyfikacji: spec-123');
  });

  it('distinguishes forbidden Workspace from transient source failures', () => {
    const queryClient = createSpecFlowQueryClient();
    const services = createSpecFlowAppServices();
    const query = queryClient.getQueryCache().build(queryClient, {
      queryKey: specificationKeys.detail('spec-forbidden'),
    });
    query.setState({
      status: 'error',
      error: new HttpClientError('Forbidden', { kind: 'http', status: 403 }),
      fetchStatus: 'idle',
      errorUpdateCount: 1,
    });

    const markup = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <UiModulesProvider modules={builtInUiModuleRegistry}>
          <TestServicesRouterContext services={services}>
            <LocalizationProvider>
              <AppShell navigation={<div>Nav</div>}>
                <SpecificationSurface specId="spec-forbidden" />
              </AppShell>
            </LocalizationProvider>
          </TestServicesRouterContext>
        </UiModulesProvider>
      </QueryClientProvider>,
    );

    expect(markup).toContain('Brak dostępu');
    expect(markup).toContain('Nie masz uprawnień');
    expect(markup).not.toContain('Specyfikacja jest niedostępna');
  });

  it('does not render retained Workspace content after a domain 404', () => {
    const queryClient = createSpecFlowQueryClient();
    const specId = 'deleted';
    const key = specificationKeys.detail(specId);
    const cached = createSpecificationWorkspaceFixture('working', specId);
    queryClient.setQueryData(key, cached);
    const query = queryClient.getQueryCache().find({ queryKey: key, exact: true });
    if (!query) throw new Error('Expected cached Workspace query');
    query.setState({
      status: 'error',
      error: new HttpClientError('Specification deleted', {
        kind: 'http',
        status: 404,
        data: { error: 'specification_not_found' },
      }),
      fetchStatus: 'idle',
      errorUpdateCount: 1,
    });

    const markup = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <UiModulesProvider modules={builtInUiModuleRegistry}>
          <TestServicesRouterContext services={createSpecFlowAppServices()}>
            <LocalizationProvider>
              <AppShell navigation={<div>Nav</div>}>
                <SpecificationSurface specId={specId} />
              </AppShell>
            </LocalizationProvider>
          </TestServicesRouterContext>
        </UiModulesProvider>
      </QueryClientProvider>,
    );

    expect(markup).toContain('Nie znaleziono specyfikacji');
    expect(markup).not.toContain(cached.title);
  });
});
