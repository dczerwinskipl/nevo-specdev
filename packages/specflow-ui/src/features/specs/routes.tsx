import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createRoute, Link, Outlet, redirect } from '@tanstack/react-router';
import { appRoute, rootRoute } from '../../app/router/root';
import { parseSpecificationCollection } from '../../app/router/search';
import { SpecsOverview } from './overview/SpecsOverview';
import { useSpecsOverview } from './overview/useSpecsOverview';
import { SpecsAccessDenied } from './overview/SpecsAccessDenied';
import { SpecificationSurface } from './SpecificationSurface';
import { operationalPrimaryLinkClassName } from './shared/OperationalList/OperationalRow';

export const specsForbiddenRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/access-denied',
  component: SpecsAccessDenied,
});

export const specsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  validateSearch: (search: Record<string, unknown>) => ({
    collection: parseSpecificationCollection(search),
  }),
  component: SpecsRouteScreen,
});

type LegacySpecificationView =
  'work' | 'documents' | 'sessions' | 'changes' | 'repository' | 'task';

const VALID_VIEWS: ReadonlySet<LegacySpecificationView> = new Set([
  'work',
  'documents',
  'sessions',
  'changes',
  'repository',
  'task',
]);

function isValidView(view: unknown): view is LegacySpecificationView {
  return typeof view === 'string' && VALID_VIEWS.has(view as LegacySpecificationView);
}

export function validateSpecificationSearch(search: Record<string, unknown>): {
  collection: 'current' | 'archive';
  view?: LegacySpecificationView;
  task?: string;
} {
  const collection = parseSpecificationCollection(search);
  const rawView = isValidView(search.view) ? search.view : undefined;
  const rawTask =
    typeof search.task === 'string' && search.task.trim().length > 0
      ? search.task.trim()
      : undefined;

  let view: LegacySpecificationView | undefined;
  let task: string | undefined;

  if (rawView === 'task') {
    view = 'task';
    task = rawTask;
  } else if (rawView) {
    view = rawView;
  } else if (rawTask) {
    view = 'task';
    task = rawTask;
  }

  return {
    collection,
    ...(view ? { view } : {}),
    ...(task ? { task } : {}),
  };
}

export const specificationRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/specs/$specId',
  validateSearch: validateSpecificationSearch,
  beforeLoad: ({ params, search }) => {
    // Normalize old tab-like URLs to canonical Primary resources.
    if (search.view === 'task') {
      if (search.task) {
        return redirect({
          to: '/specs/$specId/tasks/$taskId',
          params: { specId: params.specId, taskId: search.task },
          search: { collection: search.collection },
          replace: true,
        });
      }
      return redirect({
        to: '/specs/$specId',
        params: { specId: params.specId },
        search: { collection: search.collection },
        replace: true,
      });
    }
    if (search.view === 'work') {
      return redirect({
        to: '/specs/$specId',
        params: { specId: params.specId },
        search: { collection: search.collection },
        replace: true,
      });
    }
    if (search.view === 'documents') {
      return redirect({
        to: '/specs/$specId/documents',
        params: { specId: params.specId },
        search: { collection: search.collection },
        replace: true,
      });
    }
    if (search.view === 'sessions') {
      return redirect({
        to: '/specs/$specId/sessions',
        params: { specId: params.specId },
        search: { collection: search.collection },
        replace: true,
      });
    }
    if (search.view === 'changes') {
      return redirect({
        to: '/specs/$specId/changes',
        params: { specId: params.specId },
        search: { collection: search.collection, source: 'base' },
        replace: true,
      });
    }
    if (search.view === 'repository') {
      return redirect({
        to: '/specs/$specId/repository',
        params: { specId: params.specId },
        search: { collection: search.collection },
        replace: true,
      });
    }
  },
  component: Outlet,
});

export const specificationIndexRoute = createRoute({
  getParentRoute: () => specificationRoute,
  path: '/',
  component: SpecificationRouteScreen,
});

function SpecsRouteScreen() {
  const { specs, services } = specsRoute.useRouteContext();
  const runtimeInfo = useQuery({
    queryKey: ['runtime-info'],
    queryFn: ({ signal }) => services.runtimeInfoApi.getInfo(signal),
  });
  const { collection } = specsRoute.useSearch();
  const navigate = specsRoute.useNavigate();
  const { state, refresh } = useSpecsOverview(specs, collection);

  useEffect(() => {
    // Overview authorization denotes application-wide Specs access, unlike
    // a forbidden individual Task or Document resource.
    if (state.errorStatus === 403) void navigate({ to: '/access-denied', replace: true });
  }, [state.errorStatus, navigate]);

  if (state.errorStatus === 403) return null;

  return (
    <SpecsOverview
      state={state}
      onRefresh={refresh}
      sample={runtimeInfo.data?.dataMode === 'demo'}
      onCollectionChange={(value) => void navigate({ search: { collection: value } })}
      specificationHref={(specId) =>
        `/specs/${encodeURIComponent(specId)}?collection=${collection}`
      }
      renderSpecificationLink={(specId, children, ariaLabel) => (
        <Link
          to="/specs/$specId"
          params={{ specId }}
          search={{ collection }}
          className={operationalPrimaryLinkClassName}
          aria-label={ariaLabel}
          data-focus-ring="delegated"
        >
          {children}
        </Link>
      )}
      onOpenTarget={(target) =>
        void navigate({
          to: '/specs/$specId',
          params: { specId: target.specId },
          search: { collection },
        })
      }
    />
  );
}

function SpecificationRouteScreen() {
  const { specId } = specificationRoute.useParams();
  const { collection } = specificationRoute.useSearch();
  const navigate = specificationRoute.useNavigate();

  return (
    <SpecificationSurface
      specId={specId}
      collection={collection}
      overviewHref={`/?collection=${collection}`}
      renderBackLink={(children, className) => (
        <Link to="/" search={{ collection }} className={className}>
          {children}
        </Link>
      )}
      onBack={() => void navigate({ to: '/', search: { collection } })}

      onOpenTask={(taskId) => {
        void navigate({
          to: '/specs/$specId/tasks/$taskId',
          params: { specId, taskId },
          search: { collection },
        });
      }}
      onOpenFullDocument={(documentId) => {
        void navigate({
          to: '/specs/$specId/documents/$documentId',
          params: { specId, documentId },
          search: { collection },
          state: { specflowDocumentReturnTo: 'overview' },
        });
      }}
      onOpenDocuments={() =>
        void navigate({
          to: '/specs/$specId/documents',
          params: { specId },
          search: { collection },
        })
      }
      onOpenSessions={() =>
        void navigate({ to: '/specs/$specId/sessions', params: { specId }, search: { collection } })
      }
      onOpenRepository={() =>
        void navigate({
          to: '/specs/$specId/repository',
          params: { specId },
          search: { collection },
        })
      }
      onOpenChanges={(source = 'base') =>
        void navigate({
          to: '/specs/$specId/changes',
          params: { specId },
          search: { collection, source },
        })
      }
    />
  );
}

export const specsAppRoutes = [specsRoute] as const;
export const specsRootRoutes = [specsForbiddenRoute] as const;
