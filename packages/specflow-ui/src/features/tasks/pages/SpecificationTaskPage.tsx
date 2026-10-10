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
import { FullTaskView } from './FullTaskView';
import { mapFullTaskResponse } from '../model';
import type { useSpecificationTask } from '../useSpecificationTask';

export interface SpecificationTaskPageProps {
  readonly specId: string;
  readonly taskId: string;
  readonly collection: 'current' | 'archive';
  readonly taskState: ReturnType<typeof useSpecificationTask>;
  readonly onBack: () => void;
}

/** A routable Task page. Neither the Task list nor Workspace read is a prerequisite. */
export function SpecificationTaskPage({
  specId,
  taskId,
  collection,
  taskState,
  onBack,
}: SpecificationTaskPageProps) {
  const { t } = useTranslation();
  const backHref = `/specs/${encodeURIComponent(specId)}?collection=${collection}`;
  return (
    <AppWorkspace
      split="primary"
      labels={{
        backToPrimary: t('navigation.back'),
        closeSecondary: t('navigation.closeSecondary'),
        openNavigation: t('navigation.open'),
      }}
    >
      <AppWorkspace.Primary header={<WorkspaceHeader title={`Task / ${taskId}`} />}>
        <AppContent className="w-content-xwide max-w-full">
          <AppWorkspaceBody className="py-6">
            <AppContentContainer align="start" size="full">
              {taskState.isPending ? (
                <div className="flex items-center gap-3 py-8" role="status">
                  <Spinner size="md" aria-label={t('common.loading')} />
                  <Typography variant="body-sm">
                    {t('specification.loadingWorkspace', { id: taskId })}
                  </Typography>
                </div>
              ) : taskState.isError ? (
                <div className="grid max-w-content-standard gap-3">
                  <Alert
                    role="alert"
                    tone="attention"
                    title={
                      taskState.errorStatus === 403
                        ? t('specification.resourceAccessDeniedTitle')
                        : taskState.isTaskNotFound
                          ? t('specification.taskNotFoundTitle')
                          : t('specification.unavailableTitle')
                    }
                  >
                    {taskState.errorStatus === 403
                      ? t('specification.resourceAccessDeniedDescription')
                      : taskState.isTaskNotFound
                        ? t('specification.taskNotFoundDescription', { taskId })
                        : t('specification.unavailableDescription', { id: taskId })}
                  </Alert>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={() => void taskState.refetch()}>
                      {t('common.retry')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={onBack}>
                      {t('specification.backToSpecification')}
                    </Button>
                  </div>
                </div>
              ) : taskState.data?.task.id !== taskId ? (
                <Alert role="alert" tone="attention" title={t('specification.unavailableTitle')}>
                  {t('specification.unavailableDescription', { id: taskId })}
                </Alert>
              ) : (
                <FullTaskView
                  task={mapFullTaskResponse(taskState.data)}
                  specKey={specId}
                  onBack={onBack}
                  backHref={backHref}
                />
              )}
            </AppContentContainer>
          </AppWorkspaceBody>
        </AppContent>
      </AppWorkspace.Primary>
    </AppWorkspace>
  );
}
