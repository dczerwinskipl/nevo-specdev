import { useCallback, useMemo, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  AppShell,
  AppWorkspace,
  AppWorkspaceProvider,
  defineSecondaryStack,
  useSecondaryLeaveGuard,
  useSecondaryNavigation,
} from '@nevo/ui';
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  RouterProvider,
  Outlet,
  Link,
} from '@tanstack/react-router';
import { WorkspaceRouteLeaveGuard } from './WorkspaceRouteLeaveGuard';
import { NavigationTransitionProvider, useNavigationTransition } from './NavigationTransition';

function Editor() {
  const [calls, setCalls] = useState(0);
  const resolve = useRef<((allowed: boolean) => void) | undefined>(undefined);
  useSecondaryLeaveGuard(
    useCallback(
      () =>
        new Promise<boolean>((complete) => {
          resolve.current = complete;
          setCalls((value) => value + 1);
        }),
      [],
    ),
  );
  return (
    <div>
      <output aria-label="Guard calls">{calls}</output>
      <button type="button" onClick={() => resolve.current?.(true)}>
        Allow leaving protected draft
      </button>
      <button type="button" onClick={() => resolve.current?.(false)}>
        Keep protected draft
      </button>
    </div>
  );
}
function GuardStatus() {
  const { guardPending } = useNavigationTransition();
  return <output aria-label="Navigation pending">{String(guardPending)}</output>;
}
const stack = defineSecondaryStack<Record<never, never>, string, { editor: Record<never, never> }>({
  id: 'route-leave-contract',
  initial: 'editor',
  useData: () => ({ status: 'ready', data: 'draft' }),
  screens: { editor: { title: 'Protected draft', component: Editor } },
});
function ScopeBody() {
  const navigation = useSecondaryNavigation();
  return (
    <>
      <WorkspaceRouteLeaveGuard />
      <AppWorkspace>
        <AppWorkspace.Primary header="Primary">
          <h1>Draft owner</h1>
          <button type="button" onClick={() => void navigation.open(stack, {})}>
            Open protected draft
          </button>
        </AppWorkspace.Primary>
        <AppWorkspace.Secondary header="Secondary">Default inspection</AppWorkspace.Secondary>
      </AppWorkspace>
    </>
  );
}
function Fixture() {
  const router = useMemo(() => {
    const root = createRootRoute({
      component: () => (
        <NavigationTransitionProvider>
          <AppShell
            style={{ height: 600, width: 1280 }}
            navigation={
              <div>
                <Link to="/access-denied">Leave owner route</Link>
                <GuardStatus />
              </div>
            }
          >
            <Outlet />
          </AppShell>
        </NavigationTransitionProvider>
      ),
    });
    const source = createRoute({
      getParentRoute: () => root,
      path: '/',
      component: () => (
        <AppWorkspaceProvider scopeKey="draft">
          <ScopeBody />
        </AppWorkspaceProvider>
      ),
    });
    const destination = createRoute({
      getParentRoute: () => root,
      path: '/access-denied',
      component: () => <h1>Destination</h1>,
    });
    return createRouter({
      routeTree: root.addChildren([source, destination]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    });
  }, []);
  return (
    <div style={{ height: 600, width: 1280 }}>
      <RouterProvider router={router} />
    </div>
  );
}
const meta = {
  title: 'SpecFlow/Navigation/Workspace route leave guard',
  component: Fixture,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Fixture>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ProtectedRoute: Story = {
  tags: ['integration'],
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Open protected draft' }));
    await canvas.findByRole('button', { name: 'Allow leaving protected draft' });
    await userEvent.click(canvas.getByRole('link', { name: 'Leave owner route' }));
    await userEvent.click(canvas.getByRole('link', { name: 'Leave owner route' }));
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    if (
      canvas.getByLabelText('Guard calls').textContent !== '1' ||
      canvas.getByLabelText('Navigation pending').textContent !== 'true'
    )
      throw new Error('A deferred guard must signal pending and reject duplicate leave attempts');
    await userEvent.click(canvas.getByRole('button', { name: 'Keep protected draft' }));
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    if (canvas.getByLabelText('Navigation pending').textContent !== 'false')
      throw new Error('Denied navigation must clear pending so the user can retry');
    if (canvas.queryByRole('heading', { name: 'Destination' }))
      throw new Error('Route must honor the existing Secondary leave guard');
    await userEvent.click(canvas.getByRole('link', { name: 'Leave owner route' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Allow leaving protected draft' }));
    await canvas.findByRole('heading', { name: 'Destination' });
  },
};
