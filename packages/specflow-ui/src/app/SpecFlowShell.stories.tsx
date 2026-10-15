import type { AuthSessionResponse } from '@nevo/specflow-contracts/authentication';
import { DesignCaptureProvider } from '@nevo/figma-capture/metadata';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useMemo, useRef } from 'react';
import { useCachedQueryState } from './useCachedQueryState';
import type { SpecsOverview as Catalogue } from '../features/specs/overview/model';
import { HttpClientError, createHttpClient } from '@nevo/http-client';

import type { AppLocale } from '../i18n';
import { StoryLocalization } from '../i18n/StoryLocalization';

import type { AuthApi } from '../auth/api';
import { createAuthStore } from '../auth/store';
import { createSpecFlowRouter } from './router';

type AuthMode =
  'local' | 'required' | 'authenticated' | 'authenticated-refresh-failure' | 'unavailable';

import { QueryClientProvider } from '@tanstack/react-query';
import { createSpecFlowQueryClient } from './queryClient';
import { builtInUiModuleRegistry } from './ui-modules/builtInUiModules';
import { UiModulesProvider } from './ui-modules/UiModulesProvider';
import { createSpecFlowAppServices } from '../services';
import { specificationKeys } from '../features/specs/queries';
import { taskKeys } from '../features/tasks/queries';
import { documentKeys } from '../features/documents/queries';
import {
  createSpecificationWorkspaceFixture,
  type SpecificationScenario,
} from '../../test-support/specs/workspace/fixtures';
import { createSpecsFixture } from '../../test-support/specs/overview/fixtures';
import { specsOverviewKeys } from '../features/specs/overview/queries';
import type { SpecsOverviewApi } from '../features/specs/overview/api';
import { createFixtureSpecsOverviewApi } from '../../test-support/specs/overview/api';
import {
  createWorkspaceIntegrationApi,
  createTaskIntegrationApi,
  createDocumentIntegrationApi,
} from '../../test-support/specs/workspace/api';

export function RoutedApplication({
  authMode = 'local',
  locale = 'en',
  path = '/',
  specsStatus,
  integrationDto = false,
  navigationScenario,
  cancelNavigation = false,
  catalogueFailure,
  navigationFailure = false,
}: {
  authMode?: AuthMode;
  locale?: AppLocale;
  path?: string;
  specsStatus?: 401 | 403;
  integrationDto?: boolean;
  navigationScenario?:
    'attention' | 'partial' | 'stale' | 'unavailable' | 'long' | 'identity' | 'revoked';
  cancelNavigation?: boolean;
  catalogueFailure?: 'wrong-collection' | 'invalid-progress';
  navigationFailure?: boolean;
}) {
  const catalogueRequests = useRef(0);
  const queryClient = useMemo(() => {
    const query = createSpecFlowQueryClient();
    query.setQueryDefaults(specificationKeys.all, { staleTime: Infinity });
    if (navigationScenario === 'identity' || navigationScenario === 'long') {
      query.setQueryData(specsOverviewKeys.collection('current'), createSpecsFixture());
      query.setQueryDefaults(specsOverviewKeys.all, { staleTime: Infinity });
    }
    const listedSpecifications = [
      ...createSpecsFixture().items,
      ...createSpecsFixture('archive').items,
    ];
    const knownIds = [
      ...listedSpecifications.map((item) => item.id),
      'archive-0',
      'admission',
      'empty-scaffold',
      'preparing-spec',
      'conflict-spec',
      'no-git-spec',
      'docs-spec',
    ];
    for (const id of integrationDto ? [] : new Set(knownIds)) {
      const scenario: SpecificationScenario = id.includes('empty')
        ? 'empty'
        : id.includes('preparing')
          ? 'preparing'
          : id.includes('conflict')
            ? 'git-conflict'
            : id.includes('no-git')
              ? 'no-git'
              : 'working';
      const source = listedSpecifications.find((item) => item.id === id);
      const prepared = createSpecificationWorkspaceFixture(scenario, id);
      // Routed Storybook navigation must preserve the identity opened from Overview.
      // Pure component scenarios still exercise their independent rich fixtures.
      let fixture = source
        ? {
            ...prepared,
            title: source.title,
            intro: source.title,
          }
        : prepared;
      if (navigationScenario) {
        fixture = {
          ...fixture,
          ...(navigationScenario === 'long'
            ? {
                title:
                  'Very long specification identity describing orchestration across independently continuing agent sessions and repository boundaries',
                intro: undefined,
              }
            : {}),
          sessions: Array.from({ length: 4 }, (_, index) => ({
            id: `navigation-${index}`,
            title:
              navigationScenario === 'long'
                ? `Review of orchestration boundaries: a long readable title describing the current investigation and subsequent implementation work (${index + 1})`
                : [
                    'Review · TASK-03',
                    'Implement · TASK-04',
                    'Spec review · TASK-05',
                    'Verify · TASK-06',
                  ][index]!,
            activityCode: index === 0 ? ('attention' as const) : ('active' as const),
          })),
          ...(navigationScenario === 'unavailable'
            ? {
                sectionAvailability: {
                  ...fixture.sectionAvailability,
                  sessions: 'unavailable' as const,
                },
              }
            : {}),
        };
        if (navigationScenario === 'partial')
          fixture = {
            ...fixture,
            sessions: [...fixture.sessions, { id: 'unknown', title: 'Unknown activity' }],
          };
      }
      query.setQueryData(specificationKeys.detail(id), fixture);
      if (navigationScenario === 'stale')
        query
          .getQueryCache()
          .find({ queryKey: specificationKeys.detail(id), exact: true })
          ?.setState({ status: 'error', error: new Error('Refresh unavailable') });
      if (navigationScenario === 'revoked')
        query
          .getQueryCache()
          .find({ queryKey: specificationKeys.detail(id), exact: true })
          ?.setState({
            status: 'error',
            error: new HttpClientError('Access revoked', { kind: 'http', status: 403 }),
          });
      for (const group of fixture.taskGroups) {
        for (const task of group.tasks) {
          query.setQueryData(taskKeys.detail(id, task.id), {
            task: {
              id: task.id,
              title: task.title,
              status: {
                id: task.lifecycle ?? 'pending',
                label: task.status,
                lifecycle: task.lifecycle ?? 'pending',
              },
            },
            purpose: task.purpose,
            acceptanceCriteria: task.acceptanceCriteria ?? [],
            workflow: task.workflow,
          });
        }
      }
      for (const doc of fixture.documents) {
        query.setQueryData(documentKeys.detail(id, doc.id), {
          id: doc.id,
          title: doc.title,
          content:
            doc.content ??
            (doc.sections ?? [])
              .map((section) =>
                [
                  '# ' + section.heading,
                  section.content ?? '',
                  ...(section.items ?? []).map((item) => '- ' + item),
                ].join('\n\n'),
              )
              .join('\n\n'),
          revision: 'story-fixture',
        });
      }
    }
    return query;
  }, [integrationDto, navigationScenario]);
  const auth = useMemo(() => storyAuthStore(authMode), [authMode]);

  const services = useMemo(() => {
    const specsOverviewApi: SpecsOverviewApi = specsStatus
      ? {
          getOverview: () =>
            Promise.reject(
              new HttpClientError('Status fixture', { kind: 'http', status: specsStatus }),
            ),
        }
      : catalogueFailure
        ? {
            getOverview: () => {
              catalogueRequests.current++;
              const data = createSpecsFixture();
              return Promise.resolve(
                catalogueFailure === 'wrong-collection'
                  ? { ...data, collection: 'archive' as const }
                  : {
                      ...data,
                      items: data.items.map((item) => ({
                        ...item,
                        progress: { completed: 1, total: 0 },
                      })),
                    },
              );
            },
          }
        : createFixtureSpecsOverviewApi();

    const http = createHttpClient();
    if (specsStatus === 401) {
      // Exercise real application composition: typed API -> protected transport
      // -> AuthRecoveryCoordinator -> session -> Login. A fake feature API
      // would bypass the global mechanism and falsely test route-local recovery.
      http.get = (url: string) => {
        if (url === '/api/specs/overview') {
          return Promise.reject(new HttpClientError('Unauthorized', { kind: 'http', status: 401 }));
        }
        return Promise.reject(new Error(`Unconfigured Storybook HTTP GET: ${url}`));
      };
    }
    return createSpecFlowAppServices({
      http,
      authStore: auth,
      runtimeInfoApi: { getInfo: () => Promise.resolve({ dataMode: 'demo' }) },
      ...(specsStatus === 401 ? {} : { specsOverviewApi }),
      ...(integrationDto
        ? {
            specificationApi: createWorkspaceIntegrationApi(),
            taskApi: createTaskIntegrationApi(),
            documentApi: createDocumentIntegrationApi(),
          }
        : {}),
    });
  }, [auth, specsStatus, integrationDto, catalogueFailure]);

  const router = useMemo(() => {
    const history = createMemoryHistory({ initialEntries: [path] });
    if (cancelNavigation) history.block({ blockerFn: () => true, enableBeforeUnload: false });
    const result = createSpecFlowRouter(history, services);
    if (navigationFailure) result.navigate = () => Promise.reject(new Error('Navigation failed'));
    return result;
  }, [path, services, cancelNavigation, navigationFailure]);

  return (
    <QueryClientProvider client={queryClient}>
      <UiModulesProvider modules={builtInUiModuleRegistry}>
        <StoryLocalization locale={locale}>
          <RouterProvider router={router} />
          {catalogueFailure ? (
            <CatalogueCacheProbe requestCount={() => catalogueRequests.current} />
          ) : null}
        </StoryLocalization>
      </UiModulesProvider>
    </QueryClientProvider>
  );
}

function CatalogueCacheProbe({ requestCount }: { requestCount: () => number }) {
  const state = useCachedQueryState<Catalogue>(specsOverviewKeys.collection('current'));
  return (
    <output
      className="sr-only"
      aria-label="Catalogue fetch attempts"
      data-catalogue-status={state?.status}
      data-catalogue-present={Boolean(state?.data)}
    >
      {requestCount()}
    </output>
  );
}

const meta = {
  title: 'SpecFlow/Screens/Application Shell',
  component: RoutedApplication,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof RoutedApplication>;

export default meta;
type Story = StoryObj<typeof meta>;
const pickerFirstFailurePlay: NonNullable<Story['play']> = async ({
  canvas,
  canvasElement,
  userEvent,
}) => {
  await userEvent.click(await canvas.findByRole('button', { name: /Change specification:/ }));
  const doc = canvasElement.ownerDocument;
  await waitFor(
    () =>
      doc
        .querySelector('.popover-content')
        ?.textContent?.includes('Specification catalogue unavailable') ?? false,
    'Picker must reject malformed catalogue',
  );
  if (doc.querySelectorAll('[role="option"]').length !== 1)
    throw new Error('Only independently permitted current identity may remain in failed picker');
  const probe = canvas.getByLabelText('Catalogue fetch attempts');
  if (
    probe.getAttribute('data-catalogue-present') !== 'false' ||
    probe.getAttribute('data-catalogue-status') !== 'error'
  )
    throw new Error('Malformed response must never be successful cache data');
  const browse = doc.querySelector<HTMLAnchorElement>(
    '.popover-content a[href="/?collection=current"]',
  );
  if (!browse) throw new Error('Browse all destination missing');
  await userEvent.click(browse);
  await canvas.findByRole('alert');
  if (probe.textContent !== '1' || canvasElement.querySelector('[data-spec-id]'))
    throw new Error(
      'List must preserve protection when entering shared failed cache without refetch',
    );
};
export const PickerFirstWrongCollection: Story = {
  args: { path: '/specs/admission?collection=current', catalogueFailure: 'wrong-collection' },
  tags: ['integration'],
  play: pickerFirstFailurePlay,
};
export const PickerFirstInvalidProgress: Story = {
  args: { path: '/specs/admission?collection=current', catalogueFailure: 'invalid-progress' },
  tags: ['integration'],
  play: pickerFirstFailurePlay,
};

export const Specs: Story = {
  tags: ['visual'],
  parameters: { chromatic: { disableSnapshot: false } },
};
export const Playground: Story = { args: { path: '/ui-playground' } };
export const AuthenticationRequired: Story = { args: { authMode: 'required' } };
export const AlreadyAuthenticatedLogin: Story = {
  args: { authMode: 'authenticated', path: '/login' },
};
export const RuntimeUnavailable: Story = { args: { authMode: 'unavailable' } };
export const SpecsSessionExpired: Story = {
  args: { authMode: 'authenticated', specsStatus: 401 },
  play: async ({ canvas, canvasElement }) => {
    await canvas.findByRole('heading', { name: 'Welcome back' });
    if (canvas.queryByText('Specifications are unavailable'))
      throw new Error('401 must enter authentication, not generic unavailability.');
    if (canvasElement.querySelector('[data-product-navigation-header]'))
      throw new Error('Authentication must be outside AppShell.');
  },
};
export const SpecsForbidden: Story = {
  args: { authMode: 'authenticated', specsStatus: 403 },
  play: async ({ canvas, canvasElement }) => {
    await canvas.findByRole('heading', { name: 'Access denied' });
    if (canvas.queryByText('Welcome back') || canvas.queryByText('Specifications are unavailable'))
      throw new Error('403 must be a distinct forbidden state.');
    if (canvasElement.querySelector('[data-product-navigation-header]'))
      throw new Error('Forbidden state must be outside AppShell.');
  },
};
export const Polish: Story = { args: { locale: 'pl' } };
export const LocalAccount: Story = {
  args: { authMode: 'local' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Open user menu for Local User' }),
    );
    const accountMenu = await waitFor(
      () => document.querySelector<HTMLElement>('[role="menu"][aria-label="User menu"]'),
      'Local account menu should open.',
    );
    if (accountMenu.textContent?.includes('Sign out')) {
      throw new Error('Trusted local mode must not expose a meaningless sign-out action.');
    }
    await userEvent.keyboard('{Escape}');
  },
};

export const AuthenticatedAccount: Story = {
  args: { authMode: 'authenticated' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Open user menu for Demo' }));
    const accountMenu = await waitFor(
      () => document.querySelector<HTMLElement>('[role="menu"][aria-label="User menu"]'),
      'Authenticated account menu should open.',
    );
    if (!accountMenu.textContent?.includes('Sign out')) {
      throw new Error('Authenticated account menu should expose sign out.');
    }
    if (accountMenu.querySelectorAll('[role="menuitemradio"]').length !== 2) {
      throw new Error('Account menu should expose both language choices as radio items.');
    }
    await userEvent.keyboard('{Escape}');
  },
};

export const LogoutSuccess: Story = {
  args: { authMode: 'authenticated' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Open user menu for Demo' }));
    const signOut = await waitFor(
      () =>
        [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((item) =>
          item.textContent?.includes('Sign out'),
        ) ?? null,
      'Authenticated account menu should expose sign out.',
    );
    await userEvent.click(signOut);
    await canvas.findByRole('heading', { name: 'Welcome back' });
  },
};

export const LogoutRefreshFailure: Story = {
  args: { authMode: 'authenticated-refresh-failure' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Open user menu for Demo' }));
    const signOut = await waitFor(
      () =>
        [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((item) =>
          item.textContent?.includes('Sign out'),
        ) ?? null,
      'Authenticated account menu should expose sign out.',
    );
    await userEvent.click(signOut);
    await canvas.findByRole('heading', { name: 'Unable to connect' });
  },
};

export const Navigation: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    const rowLink = await canvas.findByRole('link', {
      name: 'Open specification: Deterministic admission and execution boundaries',
    });
    if (rowLink.getAttribute('href') !== '/specs/admission?collection=current')
      throw new Error('Production row must expose a stable owning Specification href.');
    const nav = canvasElement.querySelector('nav[aria-label="Product navigation"]');
    if (nav?.textContent?.includes('UI Playground'))
      throw new Error('Development surfaces must not be in product navigation.');
    const pr = canvas.getByRole('link', {
      name: 'Open pull request #27 — Deterministic admission and execution boundaries',
    });
    if (rowLink.contains(pr) || pr.getAttribute('href') !== 'https://example.test/pull/27')
      throw new Error('PR must remain a separate sibling destination.');
    await userEvent.click(rowLink);
    await canvas.findByRole('heading', {
      name: 'Deterministic admission and execution boundaries',
      level: 1,
    });
    await canvas.findByRole('heading', {
      name: 'Deterministic admission and execution boundaries',
      level: 1,
    });
    const back = canvas.getByRole('link', { name: 'All specifications' });
    if (back.getAttribute('href') !== '/?collection=current')
      throw new Error('Specification Back must preserve Current collection.');
    await userEvent.click(back);
    await userEvent.click(
      await canvas.findByRole('button', {
        name: 'Specification actions: Deterministic admission and execution boundaries',
      }),
    );
    const open = await waitFor(
      () =>
        [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
          (item) => item.textContent?.trim() === 'Open specification',
        ) ?? null,
      'Row overflow must offer Specification navigation.',
    );
    if (open.getAttribute('aria-disabled') === 'true')
      throw new Error('Open specification must be enabled in production composition.');
    await userEvent.click(open);
    await canvas.findByRole('heading', {
      name: 'Deterministic admission and execution boundaries',
      level: 1,
    });
    await userEvent.click(canvas.getByRole('link', { name: 'All specifications' }));
    await userEvent.click(await canvas.findByRole('radio', { name: 'Archive' }));
    const archive = await canvas.findByRole('link', {
      name: 'Open specification: Canonical Session, Turn and Work model',
    });
    if (archive.getAttribute('href') !== '/specs/archive-0?collection=archive')
      throw new Error('Archive must navigate to its own Specification with return context.');
    await userEvent.click(archive);
    await canvas.findByRole('heading', {
      name: 'Canonical Session, Turn and Work model',
      level: 1,
    });
    await userEvent.click(canvas.getByRole('link', { name: 'All specifications' }));
    const selected = await canvas.findByRole('radio', { name: 'Archive' });
    if (selected.getAttribute('aria-checked') !== 'true')
      throw new Error('Returning from Archive Specification must restore Archive.');
  },
};

function assertSpecificationNavigation(
  navigation: HTMLElement,
  specId: string,
  activeDestination: string | null,
  collection: 'current' | 'archive' = 'current',
) {
  const destinations = [
    `/specs/${specId}`,
    `/specs/${specId}/sessions`,
    `/specs/${specId}/documents`,
    `/specs/${specId}/changes`,
    `/specs/${specId}/repository`,
  ];
  const links = [...navigation.querySelectorAll<HTMLAnchorElement>('a[href]')];
  if (navigation.querySelector('[data-navigation-depth="2"]'))
    throw new Error('Context views must be flat.');
  const viewLinks = links.filter((link) =>
    new URL(link.href).pathname.startsWith(`/specs/${specId}`),
  );
  if (new URL(viewLinks[0]!.href).pathname !== destinations[0])
    throw new Error('Overview must lead the context.');
  for (const route of destinations) {
    const link = links.find((item) => new URL(item.href).pathname === route);
    if (!link) throw new Error(`Missing specification destination ${route}`);
    if (new URL(link.href).searchParams.get('collection') !== collection) {
      throw new Error(`Navigation did not preserve collection for ${route}`);
    }
    const state = link.closest('[data-navigation-state]')?.getAttribute('data-navigation-state');
    if (state !== (route === activeDestination ? 'active' : 'none')) {
      throw new Error(`Unexpected navigation state ${state} for ${route}`);
    }
  }
}

export const NavigationSpecificationActive: Story = {
  args: { path: '/specs/admission?collection=current' },
  tags: ['integration'],
  play: async ({ canvas, userEvent }) => {
    const nav = await canvas.findByRole('navigation', { name: 'Product navigation' });
    assertSpecificationNavigation(nav, 'admission', '/specs/admission');
    const switcher = canvas.getByRole('button', {
      name: /Change specification: Deterministic admission/,
    });
    await userEvent.click(switcher);
    await userEvent.keyboard('{Escape}');
    assertSpecificationNavigation(nav, 'admission', '/specs/admission');
  },
};

export const NavigationDocumentDetailActive: Story = {
  args: { path: '/specs/admission/documents/spec?collection=current' },
  tags: ['integration'],
  play: async ({ canvas }) => {
    const nav = await canvas.findByRole('navigation', { name: 'Product navigation' });
    assertSpecificationNavigation(nav, 'admission', '/specs/admission/documents');
    const title = await canvas.findByRole('heading', { name: 'Specyfikacja', level: 1 });
    if (title.closest('[data-workspace-active="true"]')?.querySelectorAll('h1').length !== 1)
      throw new Error(
        'Full Document must have one view-owned H1; embedded Markdown headings are subordinate.',
      );
  },
};

export const NavigationFullTaskAncestor: Story = {
  args: { path: '/specs/admission/tasks/TASK-03?collection=current' },
  tags: ['integration'],
  play: async ({ canvas }) => {
    const nav = await canvas.findByRole('navigation', { name: 'Product navigation' });
    assertSpecificationNavigation(nav, 'admission', null);
  },
};

export const NavigationSessionsActive: Story = {
  args: { path: '/specs/admission/sessions?collection=current' },
  tags: ['integration'],
  play: async ({ canvas }) => {
    const nav = await canvas.findByRole('navigation', { name: 'Product navigation' });
    assertSpecificationNavigation(nav, 'admission', '/specs/admission/sessions');
  },
};
export const NavigationAttention: Story = {
  args: { path: '/specs/admission?collection=current', navigationScenario: 'attention' },
  tags: ['integration'],
  play: async ({ canvas, userEvent }) => {
    const disclosure = await canvas.findByRole('button', { name: 'Collapse active sessions' });
    const panel = document.getElementById(disclosure.getAttribute('aria-controls')!);
    if (panel?.querySelectorAll('[data-session-navigation-entry]').length !== 3)
      throw new Error('Preview must bound references at three.');
    await userEvent.click(disclosure);
    await userEvent.click(canvas.getByRole('link', { name: 'Documents' }));
    await canvas.findByRole('heading', { name: 'Documents', level: 1 });
    if (
      canvas
        .getByRole('button', { name: 'Expand active sessions' })
        .getAttribute('aria-expanded') !== 'false'
    )
      throw new Error('Manual choice must survive a route change.');
  },
};
export const NavigationPartial: Story = {
  args: { path: '/specs/admission?collection=current', navigationScenario: 'partial' },
  tags: ['integration'],
  play: async ({ canvas }) => {
    await canvas.findAllByText('Activity is partially available');
    if (
      canvas
        .getByRole('button', { name: 'Expand active sessions' })
        .getAttribute('aria-expanded') !== 'false'
    )
      throw new Error('Partial data must not auto-expand.');
  },
};
export const NavigationStale: Story = {
  args: { path: '/specs/admission?collection=current', navigationScenario: 'stale' },
  tags: ['integration'],
};
export const NavigationUnavailable: Story = {
  args: { path: '/specs/admission?collection=current', navigationScenario: 'unavailable' },
  tags: ['integration'],
};
export const NavigationLongNames: Story = {
  args: { path: '/specs/admission?collection=current', navigationScenario: 'long' },
  tags: ['integration'],
};
export const NavigationIdentity: Story = {
  args: { path: '/specs/admission?collection=current', navigationScenario: 'identity' },
  tags: ['integration'],
};
export const NavigationSwitcherInteractions: Story = {
  args: {
    path: '/specs/admission/documents/spec?collection=current',
    navigationScenario: 'identity',
  },
  tags: ['integration'],
  play: async ({ canvas, canvasElement, userEvent }) => {
    await canvas.findByRole('heading', { name: 'Specyfikacja', level: 1 });
    const doc = canvasElement.ownerDocument;
    const trigger = canvas.getByRole('button', {
      name: /Change specification: Deterministic admission/,
    });
    const name = trigger.querySelector('.text-title-sm');
    if (!name) throw new Error('Identity title missing');
    await userEvent.click(name);
    const current = await waitFor(
      () => doc.querySelector<HTMLButtonElement>('[role="option"][aria-selected="true"]'),
      'Name click must open current option',
    );
    await userEvent.click(current);
    await waitFor(
      () => !doc.querySelector('.popover-content') || null,
      'Current choice must close picker',
    );
    if (!canvas.queryByRole('heading', { name: 'Specyfikacja', level: 1 }))
      throw new Error('Current choice must not reset the detail route');
    const icon = trigger.querySelector('[data-specification-switcher-icon]');
    if (!icon) throw new Error('Switcher glyph missing');
    await userEvent.click(icon);
    const search = await waitFor(
      () => doc.querySelector<HTMLInputElement>('input[aria-label="Search title or ID"]'),
      'Icon click must open search',
    );
    await userEvent.type(search, 'RT-1235');
    await waitFor(
      () =>
        doc.querySelector('[role="option"]')?.textContent?.includes('Runtime authorization') ??
        false,
      'Display-key search must find the authorized specification',
    );
    await userEvent.keyboard('{Escape}');
    await waitFor(() => !doc.querySelector('.popover-content') || null, 'Escape closes picker');
    if (doc.activeElement !== trigger) throw new Error('Dismissal restores trigger focus');
    await userEvent.keyboard('{Enter}');
    const titleSearch = await waitFor(
      () => doc.querySelector<HTMLInputElement>('input[aria-label="Search title or ID"]'),
      'Enter opens picker',
    );
    await userEvent.type(titleSearch, 'runtime');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await canvas.findByRole('heading', {
      name: 'Runtime authorization and project access policy',
      level: 1,
    });
    const nav = canvas.getByRole('navigation', { name: 'Product navigation' });
    assertSpecificationNavigation(nav, 'security', '/specs/security');
  },
};
export const NavigationUnknownContext: Story = {
  args: { path: '/specs/admission/documents/spec?collection=current', integrationDto: true },
  tags: ['integration'],
};
export const NavigationRevoked: Story = {
  args: { path: '/specs/admission?collection=current', navigationScenario: 'revoked' },
  tags: ['integration'],
  play: async ({ canvas }) => {
    const nav = await canvas.findByRole('navigation', { name: 'Product navigation' });
    if (
      nav.querySelector('[data-session-navigation-entry]') ||
      nav.textContent?.includes('Review · TASK-03')
    )
      throw new Error('Revocation must suppress retained identity/activity');
  },
};
export const NavigationCancelled: Story = {
  args: { path: '/specs/admission?collection=current', cancelNavigation: true },
  globals: { viewport: { value: 'mobile1', isRotated: false } },
  tags: ['integration'],
  play: async ({ canvas, canvasElement, userEvent }) => {
    const opener = await canvas.findByRole('button', { name: 'Open navigation' });
    await userEvent.click(opener);
    const doc = canvasElement.ownerDocument;
    const nav = await waitFor(
      () => doc.querySelector<HTMLElement>('nav[aria-label="Product navigation"]'),
      'Drawer should open',
    );
    const documents = [...nav.querySelectorAll('a')].find(
      (link) => link.textContent === 'Documents',
    )!;
    await userEvent.click(documents);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    if (!doc.querySelector('.drawer-panel[data-state="open"]'))
      throw new Error('Cancelled route must retain Drawer');
    const trigger = [...nav.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      button.getAttribute('aria-label')?.startsWith('Change specification:'),
    )!;
    await userEvent.click(trigger);
    const option = await waitFor(
      () =>
        [...doc.querySelectorAll<HTMLButtonElement>('[role="option"]')].find(
          (button) => button.getAttribute('aria-selected') === 'false',
        ),
      'Picker should load alternatives',
    );
    if (!option) throw new Error('Picker must expose an alternative');
    await userEvent.click(option);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    if (!doc.querySelector('.popover-content[data-state="open"]'))
      throw new Error('Cancelled switch must retain picker');
    await userEvent.keyboard('{Escape}');
    await waitFor(
      () => !doc.querySelector('.popover-content') || null,
      'Picker must close independently',
    );
    await waitFor(
      () => (doc.activeElement === trigger ? trigger : null),
      'Picker dismissal must restore its trigger',
    );
    await userEvent.keyboard('{Escape}');
    await waitFor(() => !doc.querySelector('.drawer-panel') || null, 'Drawer must dismiss');
    await waitFor(
      () => (doc.activeElement === opener ? opener : null),
      'Drawer dismissal must restore its actual opener',
    );
  },
};

export const QueryNavigationPreservesFocus: Story = {
  args: { path: '/?collection=current' },
  tags: ['integration'],
  play: async ({ canvas, canvasElement, userEvent }) => {
    const archive = await canvas.findByRole('radio', { name: 'Archive' });
    await userEvent.click(archive);
    await waitFor(
      () => (archive.getAttribute('aria-checked') === 'true' ? archive : null),
      'Archive query must commit',
    );
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    if (canvasElement.ownerDocument.activeElement !== archive)
      throw new Error('Query-only navigation must preserve the collection control focus');
  },
};

export const CurrentPickerKeepsView: Story = {
  args: { path: '/specs/admission/documents?collection=archive' },
  tags: ['integration'],
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = await canvas.findByRole('button', { name: /Change specification:/ });
    await userEvent.click(trigger);
    const doc = canvasElement.ownerDocument;
    const selected = await waitFor(
      () => doc.querySelector<HTMLButtonElement>('[role="option"][aria-selected="true"]'),
      'Current specification must be selected',
    );
    await userEvent.click(selected);
    await waitFor(
      () =>
        !doc.querySelector('.popover-content') && doc.activeElement === trigger ? trigger : null,
      'Selecting current identity dismisses and restores trigger',
    );
    await canvas.findByRole('heading', { name: 'Documents', level: 1 });
    if (!canvas.queryByRole('link', { name: 'Specifications' }))
      throw new Error('Routed breadcrumb must remain available');
  },
};

export const PickerFailureResetsOnOpen: Story = {
  args: { path: '/specs/admission?collection=current', navigationFailure: true },
  tags: ['integration'],
  play: async ({ canvas, canvasElement, userEvent }) => {
    const trigger = await canvas.findByRole('button', { name: /Change specification:/ });
    await userEvent.click(trigger);
    const doc = canvasElement.ownerDocument;
    const alternative = await waitFor(
      () => doc.querySelector<HTMLButtonElement>('[role="option"][aria-selected="false"]'),
      'Picker alternatives must load',
    );
    await userEvent.click(alternative);
    await waitFor(() => doc.querySelector('[role="alert"]'), 'Failed navigation must be announced');
    await userEvent.keyboard('{Escape}');
    await waitFor(
      () => (!doc.querySelector('.popover-content') ? true : null),
      'Picker closes after failure',
    );
    await userEvent.click(trigger);
    await waitFor(() => (doc.querySelector('.popover-content') ? true : null), 'Picker reopens');
    if (doc.querySelector('.popover-content [role="alert"]'))
      throw new Error('Previous navigation failure must reset on open');
    await userEvent.keyboard('{Escape}');
  },
};

export const DrawerRouteCommitFocus: Story = {
  args: { path: '/specs/admission?collection=current' },
  globals: { viewport: { value: 'mobile1', isRotated: false } },
  tags: ['integration'],
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Open navigation' }));
    const doc = canvasElement.ownerDocument;
    const link = await waitFor(
      () =>
        doc.querySelector<HTMLAnchorElement>(
          'nav a[href="/specs/admission/documents?collection=current"]',
        ),
      'Drawer Documents destination must exist',
    );
    await userEvent.click(link);
    const heading = await canvas.findByRole('heading', { name: 'Documents', level: 1 });
    await waitFor(
      () => (!doc.querySelector('.drawer-panel') && doc.activeElement === heading ? heading : null),
      'Committed Drawer navigation must close and focus view H1',
    );
  },
};

export const NavigationChangesActive: Story = {
  args: { path: '/specs/admission/changes?collection=current&source=base' },
  tags: ['integration'],
  play: async ({ canvas }) => {
    const nav = await canvas.findByRole('navigation', { name: 'Product navigation' });
    assertSpecificationNavigation(nav, 'admission', '/specs/admission/changes');
  },
};

export const NavigationRepositoryActive: Story = {
  args: { path: '/specs/admission/repository?collection=current' },
  tags: ['integration'],
  play: async ({ canvas }) => {
    const nav = await canvas.findByRole('navigation', { name: 'Product navigation' });
    assertSpecificationNavigation(nav, 'admission', '/specs/admission/repository');
  },
};

export const NavigationArchiveSpecification: Story = {
  args: { path: '/specs/archive-0?collection=archive' },
  tags: ['integration'],
  play: async ({ canvas }) => {
    const nav = await canvas.findByRole('navigation', { name: 'Product navigation' });
    assertSpecificationNavigation(nav, 'archive-0', '/specs/archive-0', 'archive');
  },
};

export const MobileNavigation: Story = {
  globals: { viewport: { value: 'mobile1', isRotated: false } },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Open navigation' }));
    const navigation = await waitFor(
      () =>
        canvasElement.ownerDocument.querySelector<HTMLElement>(
          'nav[aria-label="Product navigation"]',
        ),
      'Opening compact navigation should mount the product navigation.',
    );
    if (
      !navigation.textContent?.includes('Specifications') ||
      navigation.textContent?.includes('UI Playground')
    ) {
      throw new Error('Compact product navigation should expose only implemented product areas.');
    }
    const accountTrigger = await waitFor(
      () =>
        [...canvasElement.ownerDocument.querySelectorAll<HTMLButtonElement>('button')].find(
          (button) => button.getAttribute('aria-label') === 'Open user menu for Local User',
        ) ?? null,
      'Compact navigation should keep the account footer mounted.',
    );
    if (!accountTrigger) throw new Error('Compact navigation account footer is missing.');

    const specsLink = [...navigation.querySelectorAll<HTMLAnchorElement>('a')].find((link) =>
      link.textContent?.includes('Specifications'),
    );
    if (!specsLink) throw new Error('Compact navigation should expose Specifications.');
    await userEvent.click(specsLink);
    await waitFor(
      () => canvasElement.ownerDocument.querySelector('.drawer-panel[data-side="left"]') === null,
      'Selecting a route should close compact navigation.',
    );
    await userEvent.click(
      await canvas.findByRole('link', {
        name: 'Open specification: Deterministic admission and execution boundaries',
      }),
    );
    await canvas.findByRole('heading', {
      name: 'Deterministic admission and execution boundaries',
      level: 1,
    });
    await userEvent.click(canvas.getByRole('link', { name: 'All specifications' }));
    await canvas.findByRole('radio', { name: 'Current' });
  },
};

async function waitFor<T>(read: () => T | null | false, message: string): Promise<T> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = read();
    if (result) return result;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  throw new Error(message);
}

export const FigmaCapture: Story = {
  render: () => (
    <DesignCaptureProvider captureComponents={['SpecFlowApplicationShell']}>
      <RoutedApplication />
    </DesignCaptureProvider>
  ),
  tags: ['capture', '!autodocs'],
  parameters: {
    controls: { disable: true },
    designCapture: {
      component: 'SpecFlowApplicationShell',
      title: 'Nevo SpecFlow — Application shell',
      description: 'Desktop application shell with Specs selected',
      kind: 'screen',
      order: 200,
    },
  },
};

function storyAuthStore(mode: AuthMode) {
  if (mode === 'unavailable') {
    return createAuthStore(
      fakeApi({ getSession: () => Promise.reject(new Error('Runtime unavailable')) }),
    );
  }

  const session: AuthSessionResponse =
    mode === 'required'
      ? loginRequiredSession
      : mode === 'authenticated' || mode === 'authenticated-refresh-failure'
        ? authenticatedSession
        : localSession;

  return createAuthStore(
    fakeApi(
      mode === 'authenticated-refresh-failure'
        ? { getSession: () => Promise.reject(new Error('Runtime unavailable after logout')) }
        : undefined,
    ),
    session,
  );
}

const loginRequiredSession: AuthSessionResponse = {
  authenticationRequired: true,
  authenticated: false,
  loginMethods: {
    password: { enabled: true },
    oidc: [{ id: 'company', name: 'Company SSO' }],
  },
};

const authenticatedSession: AuthSessionResponse = {
  authenticationRequired: true,
  authenticated: true,
  user: { id: 'demo', name: 'Demo' },
  authenticatedWith: { kind: 'password' },
  loginMethods: { password: { enabled: true }, oidc: [] },
};

const localSession: AuthSessionResponse = {
  authenticationRequired: false,
  authenticated: false,
  user: { id: 'local-user', name: 'Local User' },
  loginMethods: { password: { enabled: false }, oidc: [] },
};

function fakeApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    getSession: () => Promise.resolve(loginRequiredSession),
    loginWithPassword: () => Promise.reject(new Error('not configured')),
    startOidc: () => Promise.reject(new Error('not configured')),
    logout: () => Promise.resolve(),
    ...overrides,
  };
}

export const FigmaCaptureContract: Story = {
  render: () => (
    <DesignCaptureProvider captureComponents={['SpecFlowApplicationShell']}>
      <RoutedApplication />
    </DesignCaptureProvider>
  ),
  tags: ['contract', '!autodocs'],
  play: async ({ canvasElement }) => {
    const accountTrigger = await waitFor(
      () => canvasElement.querySelector<HTMLElement>('[data-design-layer="account-trigger"]'),
      'Application shell capture should include the account trigger design layer.',
    );
    const header = canvasElement.querySelector<HTMLElement>(
      '[data-product-navigation-header="true"]',
    );
    if (!header) throw new Error('Desktop product navigation header must be present.');
    if (Number.parseFloat(getComputedStyle(header).paddingTop) < 20) {
      throw new Error('Desktop product navigation header should retain the CRM-standard top gap.');
    }

    const footer = canvasElement.querySelector<HTMLElement>(
      '[data-product-navigation-footer="true"]',
    );
    if (!footer) throw new Error('Desktop account footer must be present.');
    if (!footer.contains(accountTrigger)) {
      throw new Error('Account trigger must remain inside the fixed navigation footer.');
    }

    const navigation = canvasElement.querySelector<HTMLElement>(
      '[data-app-shell-region="navigation"]',
    );
    if (!navigation) throw new Error('Desktop application shell navigation must be present.');
    const visibleBottomGap =
      navigation.getBoundingClientRect().bottom - accountTrigger.getBoundingClientRect().bottom;
    if (visibleBottomGap < 14 || visibleBottomGap > 18) {
      throw new Error(
        `Desktop account trigger should retain the compact 16px bottom gap; received ${visibleBottomGap}px.`,
      );
    }

    if (getComputedStyle(accountTrigger).alignItems !== 'center') {
      throw new Error('Account avatar, label, and chevron must remain vertically centered.');
    }
  },
};
