import { QueryClientProvider } from '@tanstack/react-query';
import { HttpClientError } from '@nevo/http-client';
import { AppShell } from '@nevo/ui';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { createSpecFlowQueryClient } from '../../../app/queryClient';
import { appI18n, LocalizationProvider } from '../../../i18n';
import { createSpecFlowAppServices } from '../../../services';
import { TestServicesRouterContext } from '../../../../test-support/app/TestServicesRouterContext';
import { createSpecificationWorkspaceFixture } from '../../../../test-support/specs/workspace/fixtures';
import { specificationKeys } from '../queries';
import { SpecificationAggregatePage } from './SpecificationAggregatePage';

describe('Specification aggregate resource boundary', () => {
  beforeEach(async () => {
    await appI18n.changeLanguage('pl');
  });

  it.each([
    { status: 401, title: 'Specyfikacja jest niedostępna' },
    { status: 403, title: 'Brak dostępu' },
    { status: 404, title: 'Nie znaleziono specyfikacji' },
  ])('blocks retained Workspace data after HTTP $status', ({ status, title }) => {
    const specId = 'restricted';
    const client = createSpecFlowQueryClient();
    const key = specificationKeys.detail(specId);
    const cached = createSpecificationWorkspaceFixture('working', specId);
    client.setQueryData(key, cached);
    const query = client.getQueryCache().find({ queryKey: key, exact: true });
    if (!query) throw new Error('Expected cached Workspace query');
    query.setState({
      status: 'error',
      error: new HttpClientError('Resource access changed', {
        kind: 'http',
        status,
        data: status === 404 ? { error: 'specification_not_found' } : undefined,
      }),
      fetchStatus: 'idle',
      errorUpdateCount: 1,
    });

    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <TestServicesRouterContext services={createSpecFlowAppServices()}>
          <LocalizationProvider>
            <AppShell navigation={<div>Nav</div>}>
              <SpecificationAggregatePage specId={specId} title="Documents" section="documents">
                {(data) => <span>Private content: {data.title}</span>}
              </SpecificationAggregatePage>
            </AppShell>
          </LocalizationProvider>
        </TestServicesRouterContext>
      </QueryClientProvider>,
    );

    expect(html).toContain(title);
    expect(html).not.toContain('Private content');
    expect(html).not.toContain(cached.title);
  });

  it('labels a retained Workspace snapshot as stale after success followed by HTTP 503', () => {
    const specId = 'temporary';
    const client = createSpecFlowQueryClient();
    const key = specificationKeys.detail(specId);
    const cached = createSpecificationWorkspaceFixture('working', specId);
    client.setQueryData(key, cached);
    const query = client.getQueryCache().find({ queryKey: key, exact: true });
    if (!query) throw new Error('Expected cached Workspace query');

    // TanStack Query keeps the previous success while a later refresh fails.
    query.setState({
      status: 'error',
      error: new HttpClientError('Temporarily unavailable', {
        kind: 'http',
        status: 503,
        data: { error: 'specification_source_unavailable' },
      }),
      fetchStatus: 'idle',
      errorUpdateCount: 1,
    });

    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <TestServicesRouterContext services={createSpecFlowAppServices()}>
          <LocalizationProvider>
            <AppShell navigation={<div>Nav</div>}>
              <SpecificationAggregatePage specId={specId} title="Documents" section="documents">
                {(data) => <span>Retained content: {data.title}</span>}
              </SpecificationAggregatePage>
            </AppShell>
          </LocalizationProvider>
        </TestServicesRouterContext>
      </QueryClientProvider>,
    );

    expect(html).toContain('Retained content:');
    expect(html).toContain('Wyświetlane są wcześniej pobrane dane');
    expect(html).toContain('mogą być nieaktualne');
    expect(html).toContain('Spróbuj ponownie');
    expect(html).toContain('role="status"');
  });

  it('does not show stale-data warnings on a successful aggregate read', () => {
    const specId = 'fresh';
    const client = createSpecFlowQueryClient();
    client.setQueryData(
      specificationKeys.detail(specId),
      createSpecificationWorkspaceFixture('working', specId),
    );

    const html = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <TestServicesRouterContext services={createSpecFlowAppServices()}>
          <LocalizationProvider>
            <AppShell navigation={<div>Nav</div>}>
              <SpecificationAggregatePage specId={specId} title="Documents" section="documents">
                {(data) => <span>Fresh content: {data.title}</span>}
              </SpecificationAggregatePage>
            </AppShell>
          </LocalizationProvider>
        </TestServicesRouterContext>
      </QueryClientProvider>,
    );

    expect(html).toContain('Fresh content:');
    expect(html).not.toContain('Wyświetlane są wcześniej pobrane dane');
  });
});
