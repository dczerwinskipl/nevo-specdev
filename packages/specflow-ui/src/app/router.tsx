import { createRoute, createRouter, type RouterHistory } from '@tanstack/react-router';

import { authRoutes, loginRoute, runtimeUnavailableRoute } from '../auth/routes';
import {
  resolveAppAccess,
  resolveLoginAccess,
  safeReturnTo,
  type AppAccessDecision,
  type LoginAccessDecision,
} from '../auth/access';
import {
  specsAppRoutes,
  specsRootRoutes,
  specsRoute,
  specificationRoute,
  specificationIndexRoute,
  validateSpecificationSearch,
  specsForbiddenRoute,
} from '../features/specs/routes';
import { defaultSpecFlowServices } from '../services';
import { taskAppRoutes, specificationTaskRoute } from '../features/tasks/routes';
import { documentsAppRoutes } from '../features/documents/routes';
import { sessionsAppRoutes } from '../features/sessions/routes';
import { gitAppRoutes } from '../features/git/routes';
import { createSpecFlowAppServices, type SpecFlowAppServices } from './dependencies';
import { UiPlaygroundScreen } from './screens';
import { rootRoute, appRoute, type SpecFlowRouterContext } from './router/root';

export {
  rootRoute,
  appRoute,
  loginRoute,
  runtimeUnavailableRoute,
  specsRoute,
  specificationRoute,
  specificationTaskRoute,
  validateSpecificationSearch,
  specsForbiddenRoute,
  resolveAppAccess,
  resolveLoginAccess,
  safeReturnTo,
  type SpecFlowRouterContext,
  type AppAccessDecision,
  type LoginAccessDecision,
};

export const uiPlaygroundRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/ui-playground',
  component: UiPlaygroundScreen,
});

export const routeTree = rootRoute.addChildren([
  ...authRoutes,
  ...specsRootRoutes,
  appRoute.addChildren([
    ...specsAppRoutes,
    specificationRoute.addChildren([
      specificationIndexRoute,
      ...taskAppRoutes,
      ...documentsAppRoutes,
      ...sessionsAppRoutes,
      ...gitAppRoutes,
    ]),
    uiPlaygroundRoute,
  ]),
]);

export function createSpecFlowRouter(
  history?: RouterHistory,
  services: SpecFlowAppServices = createSpecFlowAppServices(),
) {
  const context: SpecFlowRouterContext = {
    services,
    auth: services.authStore,
    specs: services.specsOverviewApi,
  };

  return createRouter({
    routeTree,
    context,
    ...(history ? { history } : {}),
  });
}

export const router = createSpecFlowRouter(undefined, defaultSpecFlowServices);

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createSpecFlowRouter>;
  }
  interface HistoryState {
    /** Primary location that promoted a Document Preview or list item to Full. */
    specflowDocumentReturnTo?: 'overview' | 'documents';
  }
}
