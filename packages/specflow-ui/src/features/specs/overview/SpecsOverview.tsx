import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  AppContent,
  AppContentContainer,
  AppWorkspace,
  AppWorkspaceBody,
  Button,
  EmptyState,
  SegmentedControl,
  Skeleton,
  TextInput,
  Typography,
  WorkspaceHeader,
} from '@nevo/ui';

import type { SpecsCollection, SpecsOverviewState, CurrentSpecTarget } from './model';
import { SpecsOverviewCollection } from './SpecsOverviewCollection';
import { filterSpecsOverview } from './search';

export interface SpecsOverviewProps {
  readonly state: SpecsOverviewState;
  readonly onCollectionChange: (collection: SpecsCollection) => void;
  readonly onRefresh: () => void;
  readonly onOpenTarget?: (target: CurrentSpecTarget) => void;
  readonly onCreate?: () => void;
  readonly onCreateSession?: () => void;
  readonly sample?: boolean;
  readonly specificationHref?: (specId: string) => string;
  readonly renderSpecificationLink?: (
    specId: string,
    children: ReactNode,
    ariaLabel: string,
  ) => ReactNode;
}

export function SpecsOverview({
  state,
  onCollectionChange,
  onRefresh,
  onOpenTarget,
  onCreate,
  onCreateSession,
  sample = false,
  specificationHref,
  renderSpecificationLink,
}: SpecsOverviewProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState({ collection: state.collection, value: '' });
  const term = search.collection === state.collection ? search.value : '';
  const projection =
    state.projection?.collection === state.collection ? state.projection : undefined;
  const searchable = Boolean(
    projection && (state.collection === 'archive' || projection.items.length >= 12),
  );
  const visible = projection ? filterSpecsOverview(projection, term) : undefined;
  const busy = state.loading || state.refreshing;

  return (
    <AppWorkspace
      labels={{
        backToPrimary: t('navigation.back'),
        closeSecondary: t('navigation.closeSecondary'),
        openNavigation: t('navigation.open'),
      }}
      split="primary"
    >
      <AppWorkspace.Primary
        header={
          <WorkspaceHeader
            title={t('specifications.title')}
            labels={{
              moreActions: t('specifications.moreActions'),
              menuScope: t('specifications.title'),
            }}
            actions={[
              ...(onCreate
                ? [
                    {
                      id: 'create',
                      label: t('specifications.create'),
                      icon: 'plus' as const,
                      primary: true,
                      onPress: onCreate,
                    },
                  ]
                : []),
              {
                id: 'create-session',
                icon: 'chat-plus',
                label: t('specifications.createSession'),
                disabled: !onCreateSession,
                onPress: () => onCreateSession?.(),
              },
              {
                id: 'refresh',
                icon: 'refresh',
                label: busy ? t('specifications.refreshing') : t('specifications.refresh'),
                disabled: busy,
                onPress: onRefresh,
              },
            ]}
          />
        }
      >
        <AppContent>
          <AppWorkspaceBody className="py-6">
            <AppContentContainer align="start" className="grid gap-4" size="full">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                <SegmentedControl
                  aria-label={t('specifications.collection')}
                  value={state.collection}
                  onValueChange={(value) => onCollectionChange(value as SpecsCollection)}
                >
                  <SegmentedControl.Item value="current">
                    {t('specifications.current')}
                  </SegmentedControl.Item>
                  <SegmentedControl.Item value="archive">
                    {t('specifications.archive')}
                  </SegmentedControl.Item>
                </SegmentedControl>
                {sample ? (
                  <Typography className="text-content-muted" variant="body-sm">
                    {t('specifications.sample')}
                  </Typography>
                ) : null}
              </div>
              {sample && !specificationHref && !renderSpecificationLink ? (
                <Typography className="text-content-secondary" variant="body-sm">
                  {t('specifications.previewDescription')}
                </Typography>
              ) : null}
              {searchable ? (
                <TextInput
                  aria-label={t('specifications.search')}
                  placeholder={t('specifications.search')}
                  value={term}
                  onChange={(event) =>
                    setSearch({ collection: state.collection, value: event.target.value })
                  }
                  className="w-full"
                />
              ) : null}
              {state.refreshing ? (
                <Typography role="status" variant="body-sm" className="text-content-muted">
                  {t('specifications.refreshing')}
                </Typography>
              ) : null}
              {state.error ? (
                <Alert
                  role="alert"
                  tone={projection ? 'attention' : 'danger'}
                  title={t(
                    projection ? 'specifications.refreshFailed' : 'specifications.unavailable',
                  )}
                >
                  <p>
                    {t(
                      projection
                        ? 'specifications.refreshFailedDescription'
                        : 'specifications.unavailableDescription',
                    )}
                  </p>
                  <Button className="mt-3" onClick={onRefresh} disabled={busy} variant="secondary">
                    {t('common.retry')}
                  </Button>
                </Alert>
              ) : null}
              {state.loading ? (
                <div aria-label={t('specifications.loading')} role="status" className="grid gap-6">
                  {Array.from({ length: 4 }, (_, index) => (
                    <div aria-hidden="true" className="grid gap-3" key={index}>
                      <Skeleton className="h-5 w-3/5" />
                      <Skeleton className="h-4 w-4/5" />
                      <Skeleton className="h-3 w-2/5" />
                    </div>
                  ))}
                </div>
              ) : null}
              {visible && !state.loading ? (
                <SpecsOverviewCollection
                  projection={visible}
                  searching={term.trim().length > 0}
                  onOpenTarget={onOpenTarget}
                  specificationHref={specificationHref}
                  renderSpecificationLink={renderSpecificationLink}
                />
              ) : null}
              {visible && !visible.items.length && !state.loading ? (
                <EmptyState
                  className="border-0"
                  title={t(
                    term
                      ? 'specifications.noResults'
                      : state.collection === 'current'
                        ? 'specifications.emptyCurrent'
                        : 'specifications.emptyArchive',
                  )}
                  description={t(
                    term
                      ? 'specifications.noResultsDescription'
                      : state.collection === 'current'
                        ? 'specifications.emptyCurrentDescription'
                        : 'specifications.emptyArchiveDescription',
                  )}
                  actions={
                    term ? (
                      <Button
                        variant="secondary"
                        onClick={() => setSearch({ collection: state.collection, value: '' })}
                      >
                        {t('specifications.clearSearch')}
                      </Button>
                    ) : onCreate && state.collection === 'current' ? (
                      <Button leadingIcon="plus" onClick={onCreate}>
                        {t('specifications.create')}
                      </Button>
                    ) : undefined
                  }
                />
              ) : null}
            </AppContentContainer>
          </AppWorkspaceBody>
        </AppContent>
      </AppWorkspace.Primary>
    </AppWorkspace>
  );
}
