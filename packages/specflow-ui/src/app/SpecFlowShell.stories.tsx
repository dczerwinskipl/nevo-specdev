import type { AuthSessionResponse } from '@nevo/specflow-contracts/authentication';
import { DesignCaptureProvider } from '@nevo/figma-capture/metadata';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useMemo } from 'react';
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
}: {
  authMode?: AuthMode;
  locale?: AppLocale;
  path?: string;
  specsStatus?: 401 | 403;
  integrationDto?: boolean;
}) {
  const queryClient = useMemo(() => {
    const query = createSpecFlowQueryClient();
    query.setQueryDefaults(specificationKeys.all, { staleTime: Infinity });
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
      const fixture = source
        ? {
            ...prepared,
            title: source.title,
            intro: source.title,
          }
        : prepared;
      query.setQueryData(specificationKeys.detail(id), fixture);
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
  }, [integrationDto]);
  const auth = useMemo(() => storyAuthStore(authMode), [authMode]);

  const services = useMemo(() => {
    const specsOverviewApi: SpecsOverviewApi = specsStatus
      ? {
          getOverview: () =>
            Promise.reject(
              new HttpClientError('Status fixture', { kind: 'http', status: specsStatus }),
            ),
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
  }, [auth, specsStatus, integrationDto]);

  const router = useMemo(
    () => createSpecFlowRouter(createMemoryHistory({ initialEntries: [path] }), services),
    [path, services],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <UiModulesProvider modules={builtInUiModuleRegistry}>
        <StoryLocalization locale={locale}>
          <RouterProvider router={router} />
        </StoryLocalization>
      </UiModulesProvider>
    </QueryClientProvider>
  );
}

const meta = {
  title: 'SpecFlow/Screens/Application Shell',
  component: RoutedApplication,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof RoutedApplication>;

export default meta;
type Story = StoryObj<typeof meta>;

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
    await canvas.findByRole('heading', { name: 'Specification' });
    await canvas.findByText('Specification ID: admission');
    const back = canvas.getByRole('link', { name: 'Back to Specifications' });
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
    await canvas.findByText('Specification ID: admission');
    await userEvent.click(canvas.getByRole('link', { name: 'Back to Specifications' }));
    await userEvent.click(await canvas.findByRole('radio', { name: 'Archive' }));
    const archive = await canvas.findByRole('link', {
      name: 'Open specification: Canonical Session, Turn and Work model',
    });
    if (archive.getAttribute('href') !== '/specs/archive-0?collection=archive')
      throw new Error('Archive must navigate to its own Specification with return context.');
    await userEvent.click(archive);
    await canvas.findByText('Specification ID: archive-0');
    await userEvent.click(canvas.getByRole('link', { name: 'Back to Specifications' }));
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
    `/specs/${specId}/documents`,
    `/specs/${specId}/sessions`,
    `/specs/${specId}/changes`,
    `/specs/${specId}/repository`,
  ];
  const links = [...navigation.querySelectorAll<HTMLAnchorElement>('a[href]')];
  const group = navigation.querySelector(
    '[data-navigation-depth="1"][data-navigation-state="ancestor"]',
  );
  if (!group) throw new Error('The Specification folder should be the active route ancestor.');
  if (group.querySelector('a')) {
    throw new Error('Clicking the Specification folder must not navigate.');
  }
  const folder = group.querySelector<HTMLButtonElement>('button[aria-expanded]');
  if (!folder) throw new Error('Specification folder must have an expandable button.');
  const firstChild = navigation.querySelector<HTMLAnchorElement>(
    '[data-navigation-depth="2"] a[href]',
  );
  if (!firstChild || new URL(firstChild.href).pathname !== destinations[0]) {
    throw new Error('Overview must be the first Specification subpage.');
  }
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
    const folder = nav.querySelector<HTMLButtonElement>('button[aria-expanded]');
    if (!folder) throw new Error('Expected Specification folder button');
    if (!folder.textContent?.includes('Deterministic admission and execution boundaries')) {
      throw new Error('Specification folder should show its title from the existing projection');
    }
    await userEvent.click(folder);
    if (folder.getAttribute('aria-expanded') !== 'false') {
      throw new Error('Specification folder should collapse without navigating');
    }
    await userEvent.click(folder);
    assertSpecificationNavigation(nav, 'admission', '/specs/admission');
  },
};

export const NavigationDocumentDetailActive: Story = {
  args: { path: '/specs/admission/documents/spec?collection=current' },
  tags: ['integration'],
  play: async ({ canvas }) => {
    const nav = await canvas.findByRole('navigation', { name: 'Product navigation' });
    assertSpecificationNavigation(nav, 'admission', '/specs/admission/documents');
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
      () =>
        canvasElement.ownerDocument.querySelector(
          '.drawer-panel[data-side="left"][data-state="open"]',
        ) === null,
      'Selecting a route should close compact navigation.',
    );
    await userEvent.click(
      await canvas.findByRole('link', {
        name: 'Open specification: Deterministic admission and execution boundaries',
      }),
    );
    await canvas.findByText('Specification ID: admission');
    await userEvent.click(canvas.getByRole('link', { name: 'Back to Specifications' }));
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
