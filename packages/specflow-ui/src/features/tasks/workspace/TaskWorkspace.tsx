import {
  AppContent,
  AppWorkspace,
  AppWorkspaceBody,
  AppWorkspaceProvider,
  WorkspaceHeader,
  useSecondaryNavigation,
  useWorkspaceCapabilities,
} from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import { TaskWorkspaceState, useTaskWorkspace } from './TaskWorkspaceState';
import { TaskWorkspacePrimary } from './TaskWorkspacePrimary';
import { TaskWorkspaceHistory } from './TaskWorkspaceHistory';
import { taskWorkspaceHistoryStack, taskWorkspaceMaterialStack } from './taskWorkspaceStack';
import type { TaskWorkspaceData } from './taskWorkspaceModel';

/** Presentation-only workspace. Data and real execution belong to the application boundary. */
export function TaskWorkspace({
  data,
  onBack,
}: {
  readonly data: TaskWorkspaceData;
  readonly onBack?: () => void;
}) {
  return (
    <AppWorkspaceProvider scopeKey={data.id}>
      <TaskWorkspaceState key={data.id} data={data}>
        <Workspace onBack={onBack} />
      </TaskWorkspaceState>
    </AppWorkspaceProvider>
  );
}
function Workspace({ onBack }: { readonly onBack?: () => void }) {
  const { t } = useTranslation();
  const { data, reading } = useTaskWorkspace();
  const navigation = useSecondaryNavigation();
  const { supportsSplit } = useWorkspaceCapabilities();
  const openMaterial = (id: string) => {
    void navigation.open(taskWorkspaceMaterialStack, { taskId: data.id, id });
  };
  return (
    <AppWorkspace
      split={reading ? 'secondary' : 'primary'}
      secondaryCloseBehavior="page"
      labels={{
        backToPrimary: t('navigation.back'),
        closeSecondary: t('navigation.closeSecondary'),
        openNavigation: t('navigation.open'),
      }}
    >
      <AppWorkspace.Primary
        header={
          <WorkspaceHeader
            title={`${data.specification} / ${data.id}`}
            icon="list-checks"
            as="span"
          />
        }
      >
        <AppContent className="w-full max-w-full">
          <AppWorkspaceBody padding="none" scroll="area">
            <TaskWorkspacePrimary
              onBack={onBack}
              onMaterial={openMaterial}
              onHistory={
                !supportsSplit
                  ? () => {
                      void navigation.open(taskWorkspaceHistoryStack, { taskId: data.id });
                    }
                  : undefined
              }
            />
          </AppWorkspaceBody>
        </AppContent>
      </AppWorkspace.Primary>
      <AppWorkspace.Secondary
        header={
          <WorkspaceHeader title={t('taskWorkspace.history')} icon="clock" headingLevel={2} />
        }
      >
        <AppContent className="w-full max-w-full">
          <AppWorkspaceBody padding="none" scroll="area">
            <TaskWorkspaceHistory onMaterial={openMaterial} />
          </AppWorkspaceBody>
        </AppContent>
      </AppWorkspace.Secondary>
    </AppWorkspace>
  );
}
