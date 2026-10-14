import { useEffect, useSyncExternalStore } from 'react';
import {
  APP_NAVIGATION_INLINE_PADDING,
  NavigationRow,
  Icon,
  Separator,
  Typography,
  useAppNavigation,
  type IconGlyph,
} from '@nevo/ui';
import { Link, useMatch, useRouter, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  Home,
  MessagesSquare,
  ListChecks,
  Files,
  GitCompare,
  FolderGit2,
} from 'lucide-react';
import { designLayerMetadata } from '@nevo/figma-capture/metadata';
import type { AuthStore } from '../../auth/store';
import { AccountMenu } from '../AccountMenu';
import { NevoBrandLogo, defaultNevoBrand } from '../../brand';
import { useSpecificationNavigationMetadata } from '../../features/specs/overview/useSpecificationNavigationMetadata';
import { useSessionNavigationSummary } from '../../features/sessions/navigation/summary';
import { SpecificationSwitcher } from './SpecificationSwitcher';
import { SessionNavigationPreview } from '../../features/sessions/navigation/SessionNavigationPreview';

export function ProductNavigation({
  auth,
  onSignOut,
  preferences,
  onPreference,
}: {
  auth: AuthStore;
  onSignOut: () => void | Promise<void>;
  preferences: ReadonlyMap<string, boolean>;
  onPreference: (id: string, expanded: boolean) => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const { closeNavigation } = useAppNavigation();
  const location = useRouterState({ select: (state) => state.location });
  const collection =
    location.search.collection === 'archive' ? ('archive' as const) : ('current' as const);
  const specId =
    useMatch({
      from: '/_app/specs/$specId',
      shouldThrow: false,
      select: (match) => match.params.specId,
    }) ?? null;
  const identity = useSpecificationNavigationMetadata(specId, collection);
  const summary = useSessionNavigationSummary(specId);
  const expanded = Boolean(
    specId && (preferences.get(specId) ?? (summary.state === 'available' && summary.attention)),
  );
  useEffect(() => {
    if (specId && !preferences.has(specId) && summary.state === 'available')
      onPreference(specId, summary.attention);
  }, [
    specId,
    preferences,
    onPreference,
    summary.state,
    'attention' in summary ? summary.attention : false,
  ]);
  useEffect(
    () =>
      router.subscribe('onResolved', () => {
        const focus = () =>
          document.querySelector<HTMLElement>('[data-workspace-active="true"] h1');
        closeNavigation(focus);
        requestAnimationFrame(() => focus()?.focus());
      }),
    [router, closeNavigation],
  );
  const state = useSyncExternalStore(
    (listener) => auth.subscribe(listener),
    () => auth.getState(),
    () => auth.getState(),
  );
  const selected = (view: string) =>
    specId &&
    (view === 'overview'
      ? location.pathname === `/specs/${encodeURIComponent(specId)}`
      : location.pathname.startsWith(`/specs/${encodeURIComponent(specId)}/${view}`));
  const viewLabels = {
    overview: 'specification.viewOverview',
    sessions: 'specification.viewSessions',
    tasks: 'specification.viewTasks',
    documents: 'specification.viewDocuments',
    changes: 'specification.changesHeading',
    repository: 'specification.viewRepository',
  } as const;
  const views: {
    id: 'overview' | 'sessions' | 'tasks' | 'documents' | 'changes' | 'repository';
    icon: IconGlyph;
  }[] = [
    { id: 'overview', icon: Home },
    { id: 'sessions', icon: MessagesSquare },
    { id: 'tasks', icon: ListChecks },
    { id: 'documents', icon: Files },
    ...(identity?.hasGit === false
      ? []
      : [
          { id: 'changes' as const, icon: GitCompare },
          { id: 'repository' as const, icon: FolderGit2 },
        ]),
  ];
  const target = (view: (typeof views)[number]['id']) =>
    view === 'overview'
      ? '/specs/$specId'
      : view === 'sessions'
        ? '/specs/$specId/sessions'
        : view === 'documents'
          ? '/specs/$specId/documents'
          : view === 'changes'
            ? '/specs/$specId/changes'
            : '/specs/$specId/repository';
  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      style={{ paddingInline: APP_NAVIGATION_INLINE_PADDING }}
      {...designLayerMetadata({ layer: 'product-navigation' })}
    >
      <div
        className="shrink-0 py-5 pr-12"
        data-product-navigation-header
        {...designLayerMetadata({ layer: 'brand' })}
      >
        <NevoBrandLogo {...defaultNevoBrand} product="SpecFlow" size="md" type="horizontal" />
      </div>
      <Separator />
      <nav
        aria-label={t('navigation.product')}
        className="min-h-0 flex-1 overflow-y-auto py-4"
        {...designLayerMetadata({ layer: 'navigation-links' })}
      >
        <ul className="m-0 grid list-none gap-0.5 p-0">
          <NavigationRow
            selectionTreatment="surface"
            label={t('navigation.specifications')}
            icon={FileText}
            active={!specId && location.pathname === '/'}
            renderLink={(children, className) => (
              <Link
                to="/"
                search={{ collection }}
                className={className}
                activeOptions={{ exact: true }}
                onClick={() => {
                  if (location.pathname === '/')
                    closeNavigation(() =>
                      document.querySelector<HTMLElement>('[data-workspace-active="true"] h1'),
                    );
                }}
              >
                {children}
              </Link>
            )}
          />
        </ul>
        {specId ? (
          <section
            className="mt-5 min-w-0"
            aria-label={t('applicationNavigation.currentSpecification')}
          >
            <div className="rounded-control bg-surface-subtle" data-specification-switcher-surface>
              <SpecificationSwitcher
                specId={specId}
                title={identity?.title ?? t('specification.title')}
                displayKey={identity?.key}
                collection={collection}
                identityAvailable={Boolean(identity)}
              />
              {!identity || identity.stale ? (
                <Typography
                  as="div"
                  variant="body-sm"
                  className="px-3 pb-2 text-content-secondary"
                  role="status"
                >
                  {t(
                    identity?.stale
                      ? 'applicationNavigation.staleContext'
                      : 'applicationNavigation.contextUnavailable',
                  )}
                </Typography>
              ) : null}
            </div>
            <ul className="m-0 mt-2 grid list-none gap-0.5 p-0">
              {views.map((view) => (
                <NavigationRow
                  selectionTreatment="surface"
                  key={view.id}
                  icon={view.icon}
                  label={t(viewLabels[view.id])}
                  active={view.id !== 'tasks' && Boolean(selected(view.id))}
                  renderLink={(children, className) =>
                    view.id === 'tasks' ? (
                      <span
                        aria-disabled="true"
                        className={className}
                        title={t('applicationNavigation.tasksUnavailable')}
                      >
                        {children}
                      </span>
                    ) : (
                      <Link
                        to={target(view.id)}
                        params={{ specId }}
                        search={
                          view.id === 'changes' ? { collection, source: 'base' } : { collection }
                        }
                        className={className}
                        activeOptions={{ exact: view.id === 'overview' }}
                      >
                        {children}
                      </Link>
                    )
                  }
                  trailing={
                    view.id === 'sessions' && 'count' in summary && summary.count
                      ? t('applicationNavigation.activeCount', { count: summary.count })
                      : undefined
                  }
                  disclosure={
                    view.id === 'sessions' && 'entries' in summary && summary.entries.length
                      ? {
                          expanded,
                          label: t(
                            expanded
                              ? 'applicationNavigation.collapseSessions'
                              : 'applicationNavigation.expandSessions',
                          ),
                          onToggle: () => onPreference(specId, !expanded),
                          content: (
                            <SessionNavigationPreview entries={summary.entries}>
                              <Link
                                to="/specs/$specId/sessions"
                                params={{ specId }}
                                search={{ collection }}
                                className="group inline-flex min-h-9 items-center gap-1.5 rounded-control text-body-sm text-content-link outline-none hover:underline focus-visible:outline-2 focus-visible:outline-focus-ring [@media(pointer:coarse)]:min-h-11"
                              >
                                {t('applicationNavigation.allSessions')}
                                <Icon name="arrow-right" size="sm" className="size-3.5" />
                              </Link>
                            </SessionNavigationPreview>
                          ),
                        }
                      : undefined
                  }
                />
              ))}
            </ul>
            {summary.state === 'loading' ||
            summary.state === 'unknown' ||
            summary.state === 'unavailable' ||
            summary.state === 'partial' ||
            summary.state === 'stale' ? (
              <div className="px-2 py-1 text-body-sm text-content-secondary" role="status">
                {t(
                  summary.state === 'stale'
                    ? 'applicationNavigation.staleActivity'
                    : summary.state === 'partial'
                      ? 'applicationNavigation.partialActivity'
                      : summary.state === 'loading'
                        ? 'applicationNavigation.checkingActivity'
                        : 'applicationNavigation.activityUnavailable',
                )}
                {summary.state === 'unavailable' && summary.canRetry ? (
                  <button
                    type="button"
                    className="ml-2 underline"
                    onClick={() => void summary.retry()}
                  >
                    {t('common.retry')}
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}
      </nav>
      <Separator />
      <div
        className="shrink-0 pt-4"
        data-product-navigation-footer
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        {...designLayerMetadata({ layer: 'account-footer' })}
      >
        {state.status === 'ready' ? (
          <AccountMenu session={state.session} onSignOut={onSignOut} />
        ) : null}
      </div>
    </div>
  );
}
