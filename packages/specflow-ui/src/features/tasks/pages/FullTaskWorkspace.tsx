import { createContext, useContext } from 'react';
import {
  Alert,
  Button,
  AppContent,
  AppContentContainer,
  AppWorkspace,
  AppWorkspaceBody,
  AppWorkspaceProvider,
  WorkspaceHeader,
  defineSecondaryStack,
  useSecondaryNavigation,
  useSecondaryStack,
  useWorkspaceCapabilities,
  type SecondaryData,
  type SecondaryScreenProps,
} from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import type { FullTaskData } from '../model';
import { TaskContent } from '../detail/TaskContent';
import { inspectionAnchor, type TaskInspectionAnchor } from '../detail/taskInspectionModel';
import {
  TaskHistoryResourceInspection,
  type TaskHistoryResourceParams,
} from '../detail/TaskHistoryResourceInspection';
import { TaskHistory } from '../detail/TaskHistory';
import {
  TaskInspection,
  TaskEvidenceInspection,
  TaskEvidenceHeader,
  type TaskEvidenceParams,
  TaskResourceInspection,
  TaskContextHeader,
  TaskFlowHeader,
  TaskResourceHeader,
  TaskHistoryHeader,
} from '../detail/TaskInspection';
import { useTaskResources } from '../detail/useTaskPages';
import { mergeTaskResources } from '../detail/TaskDetails';
import { FullTaskView } from './FullTaskView';
import { TaskViewStateProvider } from '../detail/TaskViewState';

interface TaskContextData {
  task: FullTaskData;
  specId: string;
  itemId?: string;
  anchor?: TaskInspectionAnchor;
  historyResource?: TaskHistoryResourceParams;
}
interface RootParams {
  taskId: string;
  itemId?: string;
  anchor?: TaskInspectionAnchor;
  historyResource?: TaskHistoryResourceParams;
}
const Context = createContext<TaskContextData | null>(null);
interface Pages {
  work: Record<never, never>;
  flow: Record<never, never>;
  requirement: { id: string };
  evidence: TaskEvidenceParams;
  resource: { id: string };
  history: Record<never, never>;
  historyResource: TaskHistoryResourceParams;
}
function useTaskContext(params: RootParams): SecondaryData<TaskContextData> {
  const data = useContext(Context);
  return data
    ? {
        status: 'ready',
        data: {
          ...data,
          itemId: params.itemId,
          anchor: params.anchor,
          historyResource: params.historyResource,
        },
      }
    : { status: 'loading' };
}
function WorkHeader({ data }: SecondaryScreenProps<TaskContextData, Record<never, never>>) {
  return <TaskContextHeader task={data.task} />;
}
function RequirementHeader({
  data,
  params,
}: SecondaryScreenProps<TaskContextData, { id: string }>) {
  return <TaskContextHeader task={data.task} requirementId={params.id ?? data.itemId} />;
}
function WorkScreen({ data }: SecondaryScreenProps<TaskContextData, Record<never, never>>) {
  return (
    <AppContent className="w-content-standard max-w-full">
      <AppWorkspaceBody padding="none">
        <TaskInspection task={data.task} page="work" anchor={data.anchor} />
      </AppWorkspaceBody>
    </AppContent>
  );
}
function FlowScreen({ data }: SecondaryScreenProps<TaskContextData, Record<never, never>>) {
  return (
    <AppContent className="w-content-standard max-w-full">
      <AppWorkspaceBody padding="none">
        <TaskInspection task={data.task} page="flow" />
      </AppWorkspaceBody>
    </AppContent>
  );
}
function EvidenceScreen({
  data,
  params,
}: SecondaryScreenProps<TaskContextData, TaskEvidenceParams>) {
  return (
    <AppContent className="w-content-standard max-w-full">
      <AppWorkspaceBody padding="none">
        <div className="p-4">
          <TaskEvidenceInspection task={data.task} params={params} />
        </div>
      </AppWorkspaceBody>
    </AppContent>
  );
}
function RequirementScreen({
  data,
  params,
}: SecondaryScreenProps<TaskContextData, Pages['requirement']>) {
  const nav = useSecondaryStack<Pages>();
  return (
    <AppContent className="w-content-standard max-w-full">
      <AppWorkspaceBody padding="none">
        <TaskInspection
          task={data.task}
          page="requirement"
          requirementId={params.id ?? data.itemId}
          anchor={data.anchor}
          onOpenEvidence={(evidence) => {
            void nav.navTo('evidence', evidence);
          }}
        />
      </AppWorkspaceBody>
    </AppContent>
  );
}
function ResourceScreen({
  data,
  params,
}: SecondaryScreenProps<TaskContextData, Pages['resource']>) {
  const pages = useTaskResources(data.specId, data.task.id, data.task.snapshot);
  const resources = data.task.snapshot?.sections.resources;
  const refs = mergeTaskResources(
    resources?.state === 'available' ? resources.data.recommended : [],
    pages.data?.pages.map((page) => page.items) ?? [],
  );
  return (
    <AppContent className="w-content-standard max-w-full">
      <AppWorkspaceBody padding="none">
        <div className="p-4">
          <TaskResourceInspection
            resource={refs.find((ref) => ref.id === (params.id ?? data.itemId))}
          />
        </div>
      </AppWorkspaceBody>
    </AppContent>
  );
}
function HistoryResourceScreen({
  data,
  params,
}: SecondaryScreenProps<TaskContextData, TaskHistoryResourceParams>) {
  return (
    <AppContent className="w-content-standard max-w-full">
      <AppWorkspaceBody padding="none">
        <div className="p-4">
          <TaskHistoryResourceInspection
            specId={data.specId}
            taskId={data.task.id}
            snapshot={data.task.snapshot}
            params={data.historyResource ?? params}
          />
        </div>
      </AppWorkspaceBody>
    </AppContent>
  );
}
function HistoryScreen({ data }: SecondaryScreenProps<TaskContextData, Record<never, never>>) {
  const nav = useSecondaryStack<Pages>();
  return (
    <AppContent className="w-content-standard max-w-full">
      <AppWorkspaceBody padding="none">
        <TaskHistory
          specId={data.specId}
          taskId={data.task.id}
          snapshot={data.task.snapshot}
          onOpenResource={(params) => {
            void nav.navTo('historyResource', params);
          }}
        />
      </AppWorkspaceBody>
    </AppContent>
  );
}
const stack = defineSecondaryStack<RootParams, TaskContextData, Pages>({
  id: 'task-inspection',
  initial: 'work',
  useData: useTaskContext,
  screens: {
    work: { title: 'Step details', header: WorkHeader, component: WorkScreen },
    flow: { title: 'Flow', header: TaskFlowHeader, component: FlowScreen },
    requirement: {
      title: 'Requirement',
      header: RequirementHeader,
      component: RequirementScreen,
    },
    evidence: { title: 'Evidence', header: TaskEvidenceHeader, component: EvidenceScreen },
    resource: { title: 'Resource', header: TaskResourceHeader, component: ResourceScreen },
    historyResource: {
      title: 'Resource',
      header: TaskResourceHeader,
      component: HistoryResourceScreen,
    },
    history: { title: 'History', header: TaskHistoryHeader, component: HistoryScreen },
  },
});
const workStack = defineSecondaryStack<RootParams, TaskContextData, Pages>({
  ...stack,
  id: 'task-work',
  initial: 'work',
});
const flowStack = defineSecondaryStack<RootParams, TaskContextData, Pages>({
  ...stack,
  id: 'task-flow',
  initial: 'flow',
});
const requirementStack = defineSecondaryStack<RootParams, TaskContextData, Pages>({
  ...stack,
  id: 'task-requirement',
  initial: 'requirement',
});
const resourcesStack = defineSecondaryStack<RootParams, TaskContextData, Pages>({
  ...stack,
  id: 'task-resource',
  initial: 'resource',
});
const historyStack = defineSecondaryStack<RootParams, TaskContextData, Pages>({
  ...stack,
  id: 'task-history',
  initial: 'history',
});

const historyResourceStack = defineSecondaryStack<RootParams, TaskContextData, Pages>({
  ...stack,
  id: 'task-history-resource',
  initial: 'historyResource',
});

export function FullTaskWorkspace(props: {
  readonly task: FullTaskData;
  readonly specId: string;
  readonly onBack: () => void;
  readonly backHref: string;
  readonly stale?: boolean;
  readonly onRetry?: () => void;
}) {
  return (
    <AppWorkspaceProvider scopeKey={`${props.specId}:${props.task.id}`}>
      <TaskViewStateProvider key={`${props.specId}:${props.task.id}`}>
        <Context.Provider value={{ task: props.task, specId: props.specId }}>
          <Workspace {...props} />
        </Context.Provider>
      </TaskViewStateProvider>
    </AppWorkspaceProvider>
  );
}
function Workspace({
  task,
  specId,
  onBack,
  backHref,
  stale,
  onRetry,
}: {
  task: FullTaskData;
  specId: string;
  onBack: () => void;
  backHref: string;
  stale?: boolean;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  const { supportsSplit } = useWorkspaceCapabilities();
  const navigation = useSecondaryNavigation();
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
            title={`Task / ${task.id}`}
            icon="list-checks"
            actions={
              !supportsSplit
                ? [
                    {
                      id: 'history',
                      label: t('specification.taskFullHistoryHeading'),
                      icon: 'clock',
                      onPress: () => {
                        void navigation.open(historyStack, { taskId: task.id });
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
            <AppContentContainer align="start" size="full">
              {stale ? (
                <Alert tone="attention" title={t('taskDetails.pageFailed')}>
                  <Button variant="secondary" size="sm" onClick={onRetry}>
                    {t('common.retry')}
                  </Button>
                </Alert>
              ) : null}
              <FullTaskView task={task} specKey={specId} onBack={onBack} backHref={backHref}>
                <TaskContent
                  task={task}
                  specKey={specId}
                  onInspect={(page, id) => {
                    void navigation.open(
                      page === 'work' ? workStack : page === 'flow' ? flowStack : requirementStack,
                      { taskId: task.id, itemId: id, anchor: inspectionAnchor(task.snapshot) },
                    );
                  }}
                  onOpenResource={(resource) => {
                    void navigation.open(resourcesStack, { taskId: task.id, itemId: resource.id });
                  }}
                />
              </FullTaskView>
            </AppContentContainer>
          </AppWorkspaceBody>
        </AppContent>
      </AppWorkspace.Primary>
      <AppWorkspace.Secondary
        header={
          <WorkspaceHeader
            headingLevel={2}
            title={t('specification.taskFullHistoryHeading')}
            icon="clock"
          />
        }
      >
        <AppContent className="w-content-standard max-w-full">
          <AppWorkspaceBody padding="none">
            <TaskHistory
              specId={specId}
              taskId={task.id}
              snapshot={task.snapshot}
              onOpenResource={(params) => {
                void navigation.open(historyResourceStack, {
                  taskId: task.id,
                  historyResource: params,
                });
              }}
            />
          </AppWorkspaceBody>
        </AppContent>
      </AppWorkspace.Secondary>
    </AppWorkspace>
  );
}
