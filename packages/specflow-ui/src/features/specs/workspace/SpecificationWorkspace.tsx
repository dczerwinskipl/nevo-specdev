import { useCallback, useMemo, type ReactNode } from 'react';
import {
  Alert,
  AppContent,
  AppContentContainer,
  AppWorkspace,
  AppWorkspaceBody,
  AppWorkspaceProvider,
  Icon,
  Link,
  useSecondaryNavigation,
  WorkspaceHeader,
} from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import type { SpecificationWorkspaceData } from './model';
import { WorkView } from './WorkView';
import { ActivityHistory } from './ActivityHistory';
import { ExecuteModal } from './ExecuteModal';
import { NewConversationModal } from './NewConversationModal';
import { WorkspaceProvider, type WorkspaceRuntime } from './WorkspaceContext';
import {
  SpecificationSecondaryDataContext,
  taskPreviewStack,
  documentPreviewStack,
  historyStack,
  type SpecificationSecondaryContextValue,
} from './specificationSecondaryStack';
import { useSpecificationDialogs } from './useSpecificationDialogs';

function fullTaskHref(specId: string, taskId: string, collection: 'current' | 'archive'): string {
  const search = collection === 'archive' ? '?collection=archive' : '';
  return `/specs/${encodeURIComponent(specId)}/tasks/${encodeURIComponent(taskId)}${search}`;
}

export interface SpecificationWorkspaceProps {
  readonly specId: string;
  readonly collection?: 'current' | 'archive';
  readonly data: SpecificationWorkspaceData;
  readonly overviewHref?: string;
  readonly renderBackLink?: (children: ReactNode, className: string) => ReactNode;
  readonly onBack?: () => void;
  readonly onOpenDocuments?: () => void;
  readonly onOpenSessions?: () => void;
  readonly onOpenRepository?: () => void;
  readonly onOpenChanges?: (source?: 'base' | 'uncommitted' | 'mr') => void;
  readonly onOpenTask?: (taskId: string) => void;
  readonly onOpenFullDocument?: (documentId: string) => void;
  readonly onRefresh?: () => void | Promise<void>;
  readonly onExecute?: (agent: string, tasks: readonly string[]) => void | Promise<void>;
  readonly onNewConversation?: (agent: string) => void | Promise<void>;
  readonly onOpenSession?: (sessionId: string) => void;
  readonly refreshFailed?: boolean;
}

export function SpecificationWorkspace(props: SpecificationWorkspaceProps) {
  return (
    <AppWorkspaceProvider scopeKey={props.specId}>
      <SpecificationWorkspaceInner {...props} />
    </AppWorkspaceProvider>
  );
}

function SpecificationWorkspaceInner({
  specId,
  data,
  collection = 'current',
  overviewHref,
  renderBackLink,
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
  refreshFailed,
}: SpecificationWorkspaceProps) {
  const { t } = useTranslation();
  const secondaryNavigation = useSecondaryNavigation();

  const {
    executeDialogOpen,
    conversationDialogOpen,
    tasksToExecute,
    openExecuteDialog,
    closeExecuteDialog,
    handleConfirmExecute,
    openConversationDialog,
    closeConversationDialog,
    handleConfirmConversation,
  } = useSpecificationDialogs({
    onExecute,
    onNewConversation,
  });

  const handlePreviewTask = useCallback(
    (taskId: string) => {
      void secondaryNavigation.open(taskPreviewStack, { specId, taskId });
    },
    [secondaryNavigation, specId],
  );

  const handleOpenHistory = useCallback(() => {
    void secondaryNavigation.open(historyStack, { specId });
  }, [secondaryNavigation, specId]);

  const handleOpenFullTask = useCallback(
    (taskId: string) => {
      void secondaryNavigation.close();
      if (onOpenTask) {
        onOpenTask(taskId);
        return;
      }
      // Standalone presentation surfaces also promote Full Task to its canonical route.
      window.location.assign(fullTaskHref(specId, taskId, collection));
    },
    [secondaryNavigation, onOpenTask, collection, specId],
  );

  const handleOpenDoc = useCallback(
    (docId: string, _origin: 'work' | 'documents' = 'work') => {
      void secondaryNavigation.open(documentPreviewStack, { specId, documentId: docId });
    },
    [secondaryNavigation, specId],
  );

  const secondaryContextValue: SpecificationSecondaryContextValue = useMemo(
    () => ({
      specId,
      data,
      openFullTask: handleOpenFullTask,
      openFullDocument: (documentId: string) => {
        void secondaryNavigation.close();
        if (onOpenFullDocument) onOpenFullDocument(documentId);
      },
      openSession: onOpenSession,
      openDoc: (docId) => handleOpenDoc(docId, 'work'),
      previewTask: handlePreviewTask,
    }),
    [
      specId,
      data,
      handleOpenFullTask,
      onOpenFullDocument,
      secondaryNavigation,
      onOpenSession,
      handleOpenDoc,
      handlePreviewTask,
    ],
  );

  const runtime: WorkspaceRuntime = useMemo(
    () => ({
      previewTask: handlePreviewTask,
      openTask: handleOpenFullTask,
      openSession: (id) => onOpenSession?.(id),
      openSessionsView: () => onOpenSessions?.(),
      openDoc: (docId, origin = 'work') => handleOpenDoc(docId, origin),
      openDocumentsView: () => onOpenDocuments?.(),
      openRepository: () => onOpenRepository?.(),
      openChanges: (source) => onOpenChanges?.(source),
      openHistory: handleOpenHistory,
      startConversation: (_agent) => openConversationDialog(),
      executeTasks: (taskIds, _agent) => openExecuteDialog(taskIds),
      refresh: () => onRefresh?.(),
      canExecute: Boolean(onExecute),
      canStartConversation: Boolean(onNewConversation),
      canOpenSession: Boolean(onOpenSession),
      fullTaskHref: (taskId) => fullTaskHref(specId, taskId, collection),
    }),
    [
      handlePreviewTask,
      handleOpenFullTask,
      onOpenSession,
      onOpenDocuments,
      onOpenSessions,
      onOpenRepository,
      onOpenChanges,
      handleOpenDoc,
      handleOpenHistory,
      openConversationDialog,
      openExecuteDialog,
      onRefresh,
      onExecute,
      onNewConversation,
      collection,
      specId,
    ],
  );

  return (
    <SpecificationSecondaryDataContext.Provider value={secondaryContextValue}>
      <WorkspaceProvider runtime={runtime}>
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
                title={t('specification.title')}
                actions={
                  onRefresh
                    ? [
                        {
                          id: 'refresh',
                          icon: 'refresh',
                          label: t('specifications.refresh'),
                          onPress: () => {
                            void onRefresh();
                          },
                        },
                      ]
                    : []
                }
              />
            }
          >
            <AppContent className="w-content-xwide max-w-full">
              <AppWorkspaceBody className="py-6">
                <AppContentContainer align="start" size="full" className="grid gap-6">
                  {/* Eyebrow: Spec / ${specId} with back link */}
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-1.5 text-body-sm text-content-muted">
                      {renderBackLink ? (
                        renderBackLink(
                          <>
                            <Icon name="arrow-right" size="sm" className="rotate-180" />
                            <span data-spec-back-label>
                              {t('specification.backToSpecifications')}
                            </span>
                          </>,
                          'w-fit inline-flex items-center gap-1.5 font-medium text-content-secondary hover:text-content-primary',
                        )
                      ) : overviewHref ? (
                        <Link
                          href={overviewHref}
                          className="w-fit inline-flex items-center gap-1.5 font-medium text-content-secondary hover:text-content-primary"
                        >
                          <Icon name="arrow-right" size="sm" className="rotate-180" />
                          <span data-spec-back-label>
                            {t('specification.backToSpecifications')}
                          </span>
                        </Link>
                      ) : (
                        <span className="font-medium text-content-secondary">
                          <span data-spec-back-label>
                            {t('specification.backToSpecifications')}
                          </span>
                        </span>
                      )}

                      <span aria-hidden="true" className="text-content-muted">
                        /
                      </span>
                      <span
                        data-spec-identity
                        className="font-mono text-body-xs text-content-muted"
                      >
                        {t('specification.identity', { id: specId })}
                      </span>
                    </div>
                  </div>

                  {refreshFailed ? (
                    <Alert
                      tone="attention"
                      role="status"
                      title={t('specification.unavailableTitle')}
                    >
                      {t('specification.unavailableDescription', { id: specId })}
                    </Alert>
                  ) : null}

                  {/* Specification Overview contributions. Primary destinations belong to Router. */}
                  <WorkView specId={specId} data={data} />
                </AppContentContainer>
              </AppWorkspaceBody>
            </AppContent>
          </AppWorkspace.Primary>

          {/* Declarative base Secondary: Activity History shown on split-capable layouts */}
          <AppWorkspace.Secondary
            header={<WorkspaceHeader as="h2" title={t('specification.activityHistory')} />}
          >
            <AppContent>
              <ActivityHistory
                events={data.activityEvents}
                onOpenTask={handlePreviewTask}
                onOpenSession={onOpenSession}
                onOpenDoc={(docId) => handleOpenDoc(docId, 'work')}
              />
            </AppContent>
          </AppWorkspace.Secondary>
        </AppWorkspace>

        {/* Explicit Dialogs */}
        <ExecuteModal
          open={executeDialogOpen}
          selectedTasks={Array.from(tasksToExecute)}
          executionReadiness={data.executionReadiness}
          onClose={closeExecuteDialog}
          onExecute={onExecute ? handleConfirmExecute : undefined}
        />

        <NewConversationModal
          open={conversationDialogOpen}
          onClose={closeConversationDialog}
          onStart={onNewConversation ? handleConfirmConversation : undefined}
        />
      </WorkspaceProvider>
    </SpecificationSecondaryDataContext.Provider>
  );
}
