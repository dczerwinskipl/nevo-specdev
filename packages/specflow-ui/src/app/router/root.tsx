import { useEffect } from 'react';
import {
  createRootRouteWithContext,
  createRoute,
  Outlet,
  redirect,
  useRouter,
} from '@tanstack/react-router';
import type { AuthStore } from '../../auth/store';
import { resolveAppAccess, safeReturnTo } from '../../auth/access';
import type { SpecsOverviewApi } from '../../features/specs/overview/api';
import type { SpecFlowAppServices } from '../dependencies';
import { SpecFlowShell } from '../SpecFlowShell';

export interface SpecFlowRouterContext {
  readonly services: SpecFlowAppServices;
  readonly auth: AuthStore;
  readonly specs: SpecsOverviewApi;
}

export const rootRoute = createRootRouteWithContext<SpecFlowRouterContext>()({
  component: RootRouteContent,
});

function RootRouteContent() {
  const { services } = rootRoute.useRouteContext();
  const router = useRouter();

  useEffect(
    () =>
      services.authRecovery.subscribe((result) => {
        const current = router.state.location;
        const returnTo = safeReturnTo(`${current.pathname}${current.searchStr}${current.hash}`);
        if (result === 'login') {
          void router.navigate({ to: '/login', search: { returnTo }, replace: true });
        } else {
          void router.navigate({ to: '/runtime-unavailable', search: { returnTo }, replace: true });
        }
      }),
    [services.authRecovery, router],
  );

  return <Outlet />;
}

export const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_app',
  beforeLoad: async ({ context, location }) => {
    const returnTo = safeReturnTo(`${location.pathname}${location.searchStr}${location.hash}`);
    const decision = await resolveAppAccess(context.auth, returnTo);

    if (decision.kind === 'runtime-unavailable') {
      redirect({
        to: '/runtime-unavailable',
        search: { returnTo: decision.returnTo },
        throw: true,
      });
    }

    if (decision.kind === 'login') {
      redirect({
        to: '/login',
        search: { returnTo: decision.returnTo },
        throw: true,
      });
    }
  },
  component: AppRouteLayout,
});

function AppRouteLayout() {
  const { auth } = appRoute.useRouteContext();
  return (
    <SpecFlowShell auth={auth}>
      <Outlet />
    </SpecFlowShell>
  );
}
