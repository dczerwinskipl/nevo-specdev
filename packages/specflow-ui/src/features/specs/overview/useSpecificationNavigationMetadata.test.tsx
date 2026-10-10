import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HttpClientError } from '@nevo/http-client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createSpecificationWorkspaceFixture } from '../../../../test-support/specs/workspace/fixtures';
import { specificationKeys } from '../queries';
import { useSpecificationNavigationMetadata } from './useSpecificationNavigationMetadata';

function renderNavigation(queryClient: QueryClient, specId: string | null): string {
  function NavigationProbe() {
    const metadata = useSpecificationNavigationMetadata(specId);
    return (
      <span>
        {metadata
          ? `${metadata.title}|${metadata.documentCount}|${String(metadata.hasGit)}`
          : 'unknown'}
      </span>
    );
  }
  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <NavigationProbe />
    </QueryClientProvider>,
  );
}

describe('Specification navigation metadata', () => {
  it('does not fetch Workspace for a directly opened Task or Document', () => {
    const queryClient = new QueryClient();
    const getWorkspace = vi.fn().mockRejectedValue(new Error('Workspace unavailable'));
    queryClient.setQueryDefaults(specificationKeys.detail('s'), {
      queryFn: getWorkspace,
    });

    expect(renderNavigation(queryClient, 's')).toContain('unknown');
    expect(getWorkspace).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(specificationKeys.detail('s'))?.fetchStatus).toBe('idle');
  });

  it('reuses cached Workspace navigation metadata without copying its server state', () => {
    const queryClient = new QueryClient();
    const data = createSpecificationWorkspaceFixture('no-git', 's');
    queryClient.setQueryData(specificationKeys.detail('s'), data);

    expect(renderNavigation(queryClient, 's')).toContain(
      `${data.title}|${data.documents.length}|false`,
    );
    expect(renderNavigation(queryClient, null)).toContain('unknown');
  });

  it('does not present unavailable document metadata as an authoritative zero', () => {
    const queryClient = new QueryClient();
    const data = createSpecificationWorkspaceFixture('no-git', 's');
    queryClient.setQueryData(specificationKeys.detail('s'), {
      ...data,
      documents: [],
      hasGit: undefined,
      sectionAvailability: {
        ...data.sectionAvailability,
        documents: 'unavailable',
        repository: 'unavailable',
      },
    });

    expect(renderNavigation(queryClient, 's')).toContain(`${data.title}|undefined|undefined`);
  });

  it.each([401, 403, 404])('does not expose cached Workspace metadata after HTTP %i', (status) => {
    const queryClient = new QueryClient();
    const data = createSpecificationWorkspaceFixture('working', 'restricted');
    const key = specificationKeys.detail('restricted');
    queryClient.setQueryData(key, data);
    const query = queryClient.getQueryCache().find({ queryKey: key, exact: true });
    if (!query) throw new Error('Expected seeded Workspace query');
    query.setState({
      status: 'error',
      error: new HttpClientError('Resource unavailable', { kind: 'http', status }),
      fetchStatus: 'idle',
      errorUpdateCount: 1,
    });

    expect(renderNavigation(queryClient, 'restricted')).toContain('unknown');
    queryClient.clear();
  });

  it('also suppresses stale cached metadata for injected API errors with a structural status', () => {
    const client = new QueryClient();
    const specId = 'forbidden';
    const key = specificationKeys.detail(specId);
    client.setQueryData(key, createSpecificationWorkspaceFixture('working', specId));
    const query = client.getQueryCache().find({ queryKey: key, exact: true });
    if (!query) throw new Error('Expected cached Workspace query');
    query.setState({
      status: 'error',
      error: Object.assign(new Error('Forbidden by injected API'), { status: 403 }),
      fetchStatus: 'idle',
      errorUpdateCount: 1,
    });

    expect(renderNavigation(client, specId)).toContain('unknown');
    client.clear();
  });

  it('can retain harmless stale navigation hints during a transient 503', () => {
    const queryClient = new QueryClient();
    const data = createSpecificationWorkspaceFixture('working', 'temporary');
    const key = specificationKeys.detail('temporary');
    queryClient.setQueryData(key, data);
    const query = queryClient.getQueryCache().find({ queryKey: key, exact: true });
    if (!query) throw new Error('Expected seeded Workspace query');
    query.setState({
      status: 'error',
      error: new HttpClientError('Temporarily unavailable', { kind: 'http', status: 503 }),
      fetchStatus: 'idle',
      errorUpdateCount: 1,
    });

    expect(renderNavigation(queryClient, 'temporary')).toContain(data.title);
    queryClient.clear();
  });
});
