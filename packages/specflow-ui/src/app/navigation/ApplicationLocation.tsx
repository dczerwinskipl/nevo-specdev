import { LocationLink } from './LocationLink';
import {
  Breadcrumbs,
  BreadcrumbItem,
  Icon,
  Typography,
  WorkspaceHeader,
  useWorkspaceCapabilities,
  type WorkspaceHeaderAction,
  type WorkspaceHeaderProps,
} from '@nevo/ui';
import { useRouter, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useSpecificationNavigationMetadata } from '../../features/specs/overview/useSpecificationNavigationMetadata';
export type ApplicationView =
  | 'specifications'
  | 'overview'
  | 'sessions'
  | 'tasks'
  | 'documents'
  | 'changes'
  | 'repository'
  | 'task'
  | 'document';
export function applicationLocationHeader({
  title,
  view,
  specId,
  detailLabel,
  actions,
  labels,
}: {
  title: string;
  view: ApplicationView;
  specId?: string;
  detailLabel?: string;
  actions?: readonly WorkspaceHeaderAction[];
  labels?: WorkspaceHeaderProps['labels'];
}) {
  return (
    <WorkspaceHeader
      title={title}
      as="span"
      actions={actions ? [...actions] : undefined}
      labels={labels}
      identityContent={
        <ApplicationLocationIdentity
          title={title}
          view={view}
          specId={specId}
          detailLabel={detailLabel}
        />
      }
    />
  );
}
export function ApplicationLocationIdentity(props: {
  title: string;
  view: ApplicationView;
  specId?: string;
  detailLabel?: string;
}) {
  const router = useRouter({ warn: false });
  return router?.state.matches.some((match) => match.routeId.startsWith('/_app/')) ? (
    <RoutedIdentity {...props} />
  ) : (
    <span className="text-title-sm text-content-primary">{props.title}</span>
  );
}
function RoutedIdentity({
  title,
  view,
  specId,
  detailLabel,
}: {
  title: string;
  view: ApplicationView;
  specId?: string;
  detailLabel?: string;
}) {
  const { t } = useTranslation();
  const { supportsSplit } = useWorkspaceCapabilities();
  const { collection, identity, contextNotice, parent } = useApplicationLocationModel(specId, view);
  if (!supportsSplit)
    return (
      <span className="text-title-sm text-content-primary" title={contextNotice}>
        {title}
        {contextNotice ? <span className="sr-only"> · {contextNotice}</span> : null}
      </span>
    );
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2">
      <Breadcrumbs label={t('applicationNavigation.location')} className="min-w-0">
        {[
          <BreadcrumbItem key="collection" current={!specId}>
            {specId ? (
              <LocationLink
                to="/"
                search={{ collection }}
                aria-label={t('applicationNavigation.allSpecifications')}
              >
                {t('navigation.specifications')}
              </LocationLink>
            ) : (
              title
            )}
          </BreadcrumbItem>,
          ...(specId
            ? [
                <BreadcrumbItem key="specification" current={false}>
                  <LocationLink
                    className="block max-w-48 truncate"
                    title={identity}
                    aria-label={identity}
                    to="/specs/$specId"
                    params={{ specId }}
                    search={{ collection }}
                  >
                    {identity}
                  </LocationLink>
                </BreadcrumbItem>,
              ]
            : []),
          ...(parent
            ? [
                <BreadcrumbItem key="parent" current={false}>
                  {parent.to && specId ? (
                    <LocationLink to={parent.to} params={{ specId }} search={{ collection }}>
                      {parent.label}
                    </LocationLink>
                  ) : (
                    parent.label
                  )}
                </BreadcrumbItem>,
              ]
            : []),
          ...(specId
            ? [
                <BreadcrumbItem key="view" current>
                  {detailLabel ?? title}
                </BreadcrumbItem>,
              ]
            : []),
        ]}
      </Breadcrumbs>
      {contextNotice ? (
        <span className="text-body-xs text-content-secondary" role="status">
          {contextNotice}
        </span>
      ) : null}
    </div>
  );
}
function useApplicationLocationModel(specId: string | undefined, view: ApplicationView) {
  const { t } = useTranslation();
  const collection = useRouterState({
    select: (s) =>
      s.location.search.collection === 'archive' ? ('archive' as const) : ('current' as const),
  });
  const metadata = useSpecificationNavigationMetadata(specId ?? null, collection);
  const identity = metadata?.key ?? metadata?.title ?? t('specification.title');
  const contextNotice =
    specId && (!metadata || metadata.stale)
      ? t(
          metadata?.stale
            ? 'applicationNavigation.staleContext'
            : 'applicationNavigation.contextUnavailable',
        )
      : undefined;
  const parent =
    view === 'document'
      ? { label: t('specification.viewDocuments'), to: '/specs/$specId/documents' as const }
      : view === 'task'
        ? { label: t('specification.viewTasks'), to: null }
        : undefined;
  const mobileBack =
    view === 'overview'
      ? { label: t('applicationNavigation.allSpecifications'), to: '/' as const }
      : parent?.to
        ? parent
        : {
            label: t('applicationNavigation.specificationOverview'),
            to: '/specs/$specId' as const,
          };
  return {
    collection,
    metadata,
    identity,
    contextNotice,
    parent,
    mobileBack,
  };
}
export function ApplicationContextLine({
  specId,
  view,
}: {
  specId?: string;
  view: ApplicationView;
}) {
  const router = useRouter({ warn: false });
  const { supportsSplit } = useWorkspaceCapabilities();
  if (
    !router?.state.matches.some((match) => match.routeId.startsWith('/_app/')) ||
    supportsSplit ||
    !specId
  )
    return null;
  return <MobileContext specId={specId} view={view} />;
}
function MobileContext({ specId, view }: { specId: string; view: ApplicationView }) {
  const { collection, metadata, contextNotice, mobileBack } = useApplicationLocationModel(
    specId,
    view,
  );
  const content = (
    <>
      <Icon name="arrow-right" size="sm" className="shrink-0 rotate-180" />
      <span>{mobileBack.label}</span>
    </>
  );
  const classes =
    'inline-flex min-w-0 items-start gap-1.5 text-content-secondary outline-none focus-visible:outline-2 focus-visible:outline-focus-ring';
  return (
    <Typography
      as="div"
      variant="body-sm"
      className="mb-6 flex min-w-0 flex-wrap items-start gap-x-1.5 gap-y-1"
      data-application-context
    >
      <LocationLink
        to={mobileBack.to}
        params={mobileBack.to === '/' ? undefined : { specId }}
        search={{ collection }}
        className={classes}
      >
        {content}
      </LocationLink>
      {metadata?.key ? (
        <span className="whitespace-nowrap text-content-secondary">· {metadata.key}</span>
      ) : null}
      {contextNotice ? (
        <span className="text-content-secondary" role="status">
          {contextNotice}
        </span>
      ) : null}
    </Typography>
  );
}
export function ViewPageTitle({
  children,
  className = 'mb-6',
}: {
  children: string;
  className?: string;
}) {
  return (
    <Typography
      as="h1"
      variant="title-lg"
      tabIndex={-1}
      className={`${className} text-content-primary outline-none [overflow-wrap:anywhere]`}
      data-page-title
    >
      {children}
    </Typography>
  );
}
