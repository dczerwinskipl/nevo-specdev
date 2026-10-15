import {
  ApplicationLocationIdentity,
  ApplicationContextLine,
  ViewPageTitle,
} from '../../app/navigation/ApplicationLocation';
import type { ReactNode } from 'react';
import {
  Alert,
  AppContent,
  AppContentContainer,
  AppWorkspace,
  AppWorkspaceBody,
  Button,
  Spinner,
  Typography,
  WorkspaceHeader,
} from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateSpecificationWorkspace } from './queries';

import type { SpecificationWorkspaceData } from './workspace/model';
import { SpecificationWorkspace } from './workspace/SpecificationWorkspace';
import { SpecificationStandaloneBack } from './workspace/SpecificationStandaloneBack';
import { useSpecificationWorkspace } from './useSpecificationWorkspace';

export interface SpecificationSurfaceProps {
  readonly specId: string;
  readonly collection?: 'current' | 'archive';
  readonly overviewHref?: string;
  readonly renderBackLink?: (children: ReactNode, className: string) => ReactNode;
  readonly onBack?: () => void;
  readonly onOpenDocuments?: () => void;
  readonly onOpenSessions?: () => void;
  readonly onOpenRepository?: () => void;
  readonly onOpenChanges?: (source?: 'base' | 'uncommitted' | 'mr') => void;
  readonly onOpenTask?: (taskId: string) => void;
  readonly onOpenFullDocument?: (documentId: string) => void;
  readonly data?: SpecificationWorkspaceData;
  readonly onRefresh?: () => void | Promise<void>;
  readonly onExecute?: (agent: string, tasks: readonly string[]) => void | Promise<void>;
  readonly onNewConversation?: (agent: string) => void | Promise<void>;
  readonly onOpenSession?: (sessionId: string) => void;
}

/** Specification workspace screen. */
export function SpecificationSurface(props: SpecificationSurfaceProps) {
  const { data: propData } = props;

  // If explicit data is provided (e.g. from Storybook or tests), render directly.
  if (propData) {
    return <SpecificationWorkspace {...props} data={propData} />;
  }

  // Otherwise, use the canonical feature query.
  return <SpecificationSurfaceConnected {...props} />;
}

function SpecificationSurfaceConnected({
  specId,
  collection,
  overviewHref,
  renderBackLink,
  onBack,
  onOpenDocuments,
  onOpenSessions,
  onOpenRepository,
  onOpenChanges,
  onOpenTask,
  onOpenFullDocument,
  onRefresh,
  onExecute,
  onNewConversation,
  onOpenSession,
}: SpecificationSurfaceProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, errorStatus, isDomainNotFound, refetch } =
    useSpecificationWorkspace(specId);

  if (isError && (!data || errorStatus === 401 || errorStatus === 403 || errorStatus === 404)) {
    return (
      <AppWorkspace
        split="primary"
        labels={{
          backToPrimary: t('navigation.back'),
          closeSecondary: t('navigation.closeSecondary'),
          openNavigation: t('navigation.open'),
        }}
      >
        <AppWorkspace.Primary
          header={
            <WorkspaceHeader
              title={t('specification.viewOverview')}
              as="span"
              identityContent={
                <ApplicationLocationIdentity
                  title={t('specification.viewOverview')}
                  view="overview"
                  specId={specId}
                />
              }
            />
          }
        >
          <AppContent className="w-content-xwide max-w-full">
            <AppWorkspaceBody className="py-8">
              <AppContentContainer align="start" size="full" className="grid gap-6">
                <div>
                  <ApplicationContextLine specId={specId} view="overview" />
                  <SpecificationStandaloneBack
                    overviewHref={overviewHref}
                    renderBackLink={renderBackLink}
                    onBack={onBack}
                  />
                  <ViewPageTitle className="mb-0">{t('specification.title')}</ViewPageTitle>
                </div>
                <Alert
                  role="alert"
                  tone="attention"
                  title={
                    errorStatus === 403
                      ? t('specification.resourceAccessDeniedTitle')
                      : isDomainNotFound
                        ? t('specification.notFoundTitle')
                        : t('specification.unavailableTitle')
                  }
                  className="max-w-content-standard"
                >
                  <Typography variant="body-sm" className="text-content-secondary">
                    {errorStatus === 403
                      ? t('specification.resourceAccessDeniedDescription')
                      : isDomainNotFound
                        ? t('specification.notFoundDescription', { id: specId })
                        : t('specification.unavailableDescription', { id: specId })}
                  </Typography>

                  <div className="mt-3 flex items-center gap-3">
                    <Button variant="secondary" size="sm" onClick={() => void refetch()}>
                      {t('common.retry')}
                    </Button>
                  </div>
                </Alert>
              </AppContentContainer>
            </AppWorkspaceBody>
          </AppContent>
        </AppWorkspace.Primary>
      </AppWorkspace>
    );
  }

  if (isLoading || !data) {
    return (
      <AppWorkspace
        split="primary"
        labels={{
          backToPrimary: t('navigation.back'),
          closeSecondary: t('navigation.closeSecondary'),
          openNavigation: t('navigation.open'),
        }}
      >
        <AppWorkspace.Primary
          header={
            <WorkspaceHeader
              title={t('specification.viewOverview')}
              as="span"
              identityContent={
                <ApplicationLocationIdentity
                  title={t('specification.viewOverview')}
                  view="overview"
                  specId={specId}
                />
              }
            />
          }
        >
          <AppContent className="w-content-xwide max-w-full">
            <AppWorkspaceBody className="py-12">
              <AppContentContainer
                align="start"
                size="full"
                className="flex flex-col items-center justify-center gap-4 text-center"
              >
                <SpecificationStandaloneBack
                  overviewHref={overviewHref}
                  renderBackLink={renderBackLink}
                  onBack={onBack}
                />
                <ViewPageTitle>{t('specification.title')}</ViewPageTitle>
                <Spinner size="md" aria-label={t('common.loading')} />
                <Typography variant="body-sm" className="text-content-muted">
                  {t('specification.loadingWorkspace', { id: specId })}
                </Typography>
              </AppContentContainer>
            </AppWorkspaceBody>
          </AppContent>
        </AppWorkspace.Primary>
      </AppWorkspace>
    );
  }

  const refreshWorkspace = async () => {
    await invalidateSpecificationWorkspace(queryClient, specId);
  };

  return (
    <SpecificationWorkspace
      specId={specId}
      collection={collection}
      data={data}
      overviewHref={overviewHref}
      renderBackLink={renderBackLink}
      onBack={onBack}
      onOpenDocuments={onOpenDocuments}
      onOpenSessions={onOpenSessions}
      onOpenRepository={onOpenRepository}
      onOpenChanges={onOpenChanges}
      onOpenTask={onOpenTask}
      onOpenFullDocument={onOpenFullDocument}
      onRefresh={onRefresh ?? refreshWorkspace}
      onExecute={onExecute}
      onNewConversation={onNewConversation}
      onOpenSession={onOpenSession}
      refreshFailed={isError && Boolean(data)}
    />
  );
}
