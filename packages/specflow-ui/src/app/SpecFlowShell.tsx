import { useEffect, useMemo, useState, useSyncExternalStore, type PropsWithChildren } from 'react';

import { designLayerMetadata, designSlot, useDesignMetadata } from '@nevo/figma-capture/metadata';
import {
  APP_NAVIGATION_INLINE_PADDING,
  AppShell,
  Separator,
  SideNavigation,
  useAppNavigation,
  type IconName,
  type NavigationAdapter,
  type NavigationNode,
} from '@nevo/ui';
import { Link, useMatch, useMatchRoute, useRouter, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import type { AuthStore } from '../auth/store';
import { defaultNevoBrand, NevoBrandLogo } from '../brand';
import { AccountMenu } from './AccountMenu';

import { useSpecificationNavigationMetadata } from '../features/specs/overview/useSpecificationNavigationMetadata';

/** Sidebar destinations only; Full Task and Document Detail are not menu entries. */
type SidebarTarget =
  | {
      readonly to: '/';
      readonly search: { readonly collection: 'current' | 'archive' };
    }
  | {
      readonly to:
        | '/specs/$specId'
        | '/specs/$specId/documents'
        | '/specs/$specId/sessions'
        | '/specs/$specId/changes'
        | '/specs/$specId/repository';
      readonly params: { readonly specId: string };
      readonly search: {
        readonly collection: 'current' | 'archive';
        readonly source?: 'base';
      };
    };

function ProductNavigation({
  auth,
  onSignOut,
}: {
  readonly auth: AuthStore;
  readonly onSignOut: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const { closeNavigation } = useAppNavigation();
  const matchRoute = useMatchRoute();
  const collection = useRouterState({
    select: (state) => (state.location.search.collection === 'archive' ? 'archive' : 'current'),
  });
  const activeSpecId =
    useMatch({
      from: '/_app/specs/$specId',
      shouldThrow: false,
      select: (match) => match.params.specId,
    }) ?? null;
  const specMetadata = useSpecificationNavigationMetadata(activeSpecId);

  const state = useSyncExternalStore(
    (listener) => auth.subscribe(listener),
    () => auth.getState(),
    () => auth.getState(),
  );

  const [expandedKeys, setExpandedKeys] = useState<readonly string[]>(() =>
    activeSpecId ? [`spec-${activeSpecId}`] : [],
  );

  useEffect(() => {
    if (activeSpecId) {
      setExpandedKeys((prev) =>
        prev.includes(`spec-${activeSpecId}`) ? prev : [...prev, `spec-${activeSpecId}`],
      );
    }
  }, [activeSpecId]);

  const navigationNodes = useMemo<readonly NavigationNode<SidebarTarget>[]>(() => {
    const rootNodes: NavigationNode<SidebarTarget>[] = [
      {
        key: 'specs',
        label: t('navigation.specifications'),
        target: { to: '/', search: { collection } },
      },
    ];

    if (activeSpecId) {
      const docCount = specMetadata?.documentCount;
      const docsLabel =
        docCount !== undefined
          ? `${t('specification.viewDocuments')} ${docCount}`
          : t('specification.viewDocuments');
      const hasGit = specMetadata?.hasGit !== false;

      rootNodes.push({
        key: `spec-${activeSpecId}`,
        label: specMetadata?.title ?? activeSpecId,
        children: [
          {
            key: 'spec-view-overview',
            label: t('specification.viewOverview'),
            target: {
              to: '/specs/$specId',
              params: { specId: activeSpecId },
              search: { collection },
            },
          },
          {
            key: `spec-view-documents`,
            label: docsLabel,
            target: {
              to: '/specs/$specId/documents',
              params: { specId: activeSpecId },
              search: { collection },
            },
          },
          {
            key: `spec-view-sessions`,
            label: t('specification.viewSessions'),
            target: {
              to: '/specs/$specId/sessions',
              params: { specId: activeSpecId },
              search: { collection },
            },
          },
          ...(hasGit
            ? [
                {
                  key: `spec-view-changes`,
                  label: t('specification.viewChanges'),
                  target: {
                    to: '/specs/$specId/changes' as const,
                    params: { specId: activeSpecId },
                    search: { collection, source: 'base' } as const,
                  },
                },
                {
                  key: `spec-view-repository`,
                  label: t('specification.viewRepository'),
                  target: {
                    to: '/specs/$specId/repository' as const,
                    params: { specId: activeSpecId },
                    search: { collection } as const,
                  },
                },
              ]
            : []),
        ],
      });
    }

    return rootNodes;
  }, [activeSpecId, collection, specMetadata, t]);

  const rootIcons = useMemo(() => {
    const icons: Record<string, IconName> = {
      specs: 'workflow',
    };
    if (activeSpecId) {
      icons[`spec-${activeSpecId}`] = 'file';
    }
    return icons;
  }, [activeSpecId]);

  const navigationAdapter = useMemo<NavigationAdapter<SidebarTarget>>(
    () => ({
      match: (node) => {
        const target = node.target;
        if (!target) {
          // Full Task has no list destination yet; keep the owning Specification group visible.
          return activeSpecId && node.key === `spec-${activeSpecId}` ? 'ancestor' : 'none';
        }

        // The Router owns route matching. Child routes keep their parent expanded,
        // while a detail Document keeps its Documents destination selected.
        if (target.to === '/') {
          return matchRoute({ to: '/', fuzzy: false }) ? 'active' : 'none';
        }
        if (matchRoute({ to: target.to, params: target.params, fuzzy: false })) return 'active';
        if (target.to === '/specs/$specId') return 'none';
        if (matchRoute({ to: target.to, params: target.params, fuzzy: true })) {
          return node.children?.length ? 'ancestor' : 'active';
        }
        return 'none';
      },
      renderLink: ({ children, className, node }) => {
        const target = node.target;
        if (!target) return <span className={className}>{children}</span>;
        if (target.to === '/') {
          return (
            <Link className={className} to="/" search={target.search} onClick={closeNavigation}>
              {children}
            </Link>
          );
        }
        return (
          <Link
            className={className}
            to={target.to}
            params={target.params}
            search={target.search}
            onClick={closeNavigation}
          >
            {children}
          </Link>
        );
      },
    }),
    [closeNavigation, matchRoute],
  );

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      style={{ paddingInline: APP_NAVIGATION_INLINE_PADDING }}
      {...designLayerMetadata({ layer: 'product-navigation' })}
    >
      <div
        className="shrink-0 py-5 pr-12"
        data-product-navigation-header="true"
        {...designLayerMetadata({ layer: 'brand' })}
      >
        <NevoBrandLogo {...defaultNevoBrand} product="SpecFlow" size="md" type="horizontal" />
      </div>

      <Separator />

      <SideNavigation
        aria-label={t('navigation.product')}
        adapter={navigationAdapter}
        className="min-h-0 flex-1 overflow-y-auto py-4"
        nodes={navigationNodes}
        rootIcons={rootIcons}
        expandedKeys={expandedKeys}
        onExpandedKeysChange={setExpandedKeys}
        {...designLayerMetadata({ layer: 'navigation-links' })}
      />

      <Separator />

      <div
        className="shrink-0 pt-4"
        data-product-navigation-footer="true"
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

export function SpecFlowShell({ auth, children }: PropsWithChildren<{ readonly auth: AuthStore }>) {
  const { t } = useTranslation();
  const router = useRouter();
  const capture = useDesignMetadata('SpecFlowApplicationShell', { viewport: 'desktop' });

  const signOut = async () => {
    const operation = auth.logout();
    const expectedMutation = auth.mutationGeneration();
    try {
      await operation;
      if (auth.mutationGeneration() !== expectedMutation) return;
      await router.navigate({ to: '/login', search: { returnTo: '/' }, replace: true });
    } catch {
      if (auth.mutationGeneration() !== expectedMutation) return;
      await router.navigate({
        to: '/runtime-unavailable',
        search: { returnTo: '/' },
        replace: true,
      });
    }
  };

  return (
    <div className="h-dvh w-full" {...capture}>
      <div className="h-full" {...designSlot('SpecFlowApplicationShell', 'shell')}>
        <AppShell
          brandPrimary={defaultNevoBrand.coreColor}
          labels={{
            closeNavigation: t('navigation.close'),
            navigationTitle: t('navigation.title'),
          }}
          navigation={<ProductNavigation auth={auth} onSignOut={signOut} />}
        >
          {children}
        </AppShell>
      </div>
    </div>
  );
}
