import { createContext, useContext } from 'react';
import {
  AppContent,
  AppWorkspaceBody,
  defineSecondaryStack,
  useSecondaryStack,
  WorkspaceHeaderIdentity,
  type SecondaryData,
  type SecondaryScreenProps,
  type WorkspaceHeaderAction,
} from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import { appI18n } from '../../../i18n';
import type { ActivityEvent, SpecificationWorkspaceData, TaskGroup, TaskItem } from './model';
import {
  inspectionAnchor,
  type TaskInspectionAnchor,
} from '../../tasks/detail/taskInspectionModel';
import { TaskPreview } from '../../tasks/inspectors/TaskPreview';
import {
  TaskInspection,
  TaskEvidenceInspection,
  TaskEvidenceHeader,
  type TaskEvidenceParams,
  TaskResourceInspection,
  TaskContextHeader,
  TaskFlowHeader,
  TaskResourceHeader,
} from '../../tasks/detail/TaskInspection';
import { useTaskResources } from '../../tasks/detail/useTaskPages';
import { mergeTaskResources } from '../../tasks/detail/TaskDetails';
import { mapFullTaskResponse } from '../../tasks/model';
import { useSpecificationTask } from '../../tasks/useSpecificationTask';
import { ActivityHistory } from './ActivityHistory';
import { DocumentContent } from '../../documents/connected/DocumentContent';

export interface SpecificationSecondaryContextValue {
  readonly specId: string;
  readonly data: SpecificationWorkspaceData;
  readonly openFullTask: (taskId: string) => void;
  readonly openFullDocument?: (documentId: string) => void;
  readonly openSession?: (sessionId: string) => void;
  readonly openDoc?: (docId: string) => void;
  readonly previewTask: (taskId: string) => void;
}

export const SpecificationSecondaryDataContext =
  createContext<SpecificationSecondaryContextValue | null>(null);

export interface TaskPreviewSecondaryData {
  readonly fullTaskLabel?: string;
  readonly specId: string;
  readonly task: TaskItem;
  readonly groups: readonly TaskGroup[];
  readonly openFullTask: (taskId: string) => void;
}

export function useTaskPreviewData({
  specId,
  taskId,
}: {
  specId: string;
  taskId: string;
}): SecondaryData<TaskPreviewSecondaryData> {
  const { t } = useTranslation();
  const context = useContext(SpecificationSecondaryDataContext);
  const listTask = context?.data.taskGroups
    .flatMap((group) => group.tasks)
    .find((task) => task.id === taskId);
  // Attention/Activity may reference a Task absent from the current Workspace projection.
  const detail = useSpecificationTask(specId, taskId, undefined, Boolean(context));
  if (!context) return { status: 'loading' };
  if (detail.isError && (detail.errorStatus === 403 || detail.isTaskNotFound)) {
    return taskPreviewFailure(detail.errorStatus, detail.isTaskNotFound, taskId, () => {
      void detail.refetch();
    });
  }

  let task: TaskItem;
  if (listTask) {
    task =
      detail.data?.task.id === taskId
        ? { ...listTask, ...mapFullTaskResponse(detail.data) }
        : listTask;
  } else {
    if (detail.isPending) return { status: 'loading' };
    if (detail.isError) {
      return taskPreviewFailure(detail.errorStatus, detail.isTaskNotFound, taskId, () => {
        void detail.refetch();
      });
    }

    const detailTask = detail.data?.task;
    if (detailTask?.id !== taskId) {
      return {
        status: 'error',
        message: appI18n.t('specification.taskPreviewLoadFailed'),
        retry: () => {
          void detail.refetch();
        },
      };
    }
    task = {
      statusCode: detailTask.status.lifecycle,
      lifecycle: detailTask.status.lifecycle,
      group: '',
      ...mapFullTaskResponse(detail.data),
    };
  }

  return {
    status: 'ready',
    data: {
      specId,
      task,
      groups: context.data.taskGroups,
      fullTaskLabel: t('specification.fullTaskView'),
      openFullTask: context.openFullTask,
    },
  };
}

/** Map the Runtime Task error into the existing Secondary Stack states. */
export function taskPreviewFailure(
  httpStatus: number | undefined,
  isTaskNotFound: boolean,
  taskId: string,
  retry: () => void,
): SecondaryData<TaskPreviewSecondaryData> {
  if (httpStatus === 403) {
    return {
      status: 'access-denied',
      message: appI18n.t('specification.taskPreviewAccessDenied'),
    };
  }
  if (httpStatus === 404 && isTaskNotFound) {
    return {
      status: 'unavailable',
      message: appI18n.t('specification.taskNotFoundDescription', { taskId }),
    };
  }
  return {
    status: 'error',
    message:
      httpStatus === 401
        ? appI18n.t('specification.taskPreviewSessionExpired')
        : httpStatus === 503
          ? appI18n.t('specification.taskPreviewSourceUnavailable')
          : appI18n.t('specification.taskPreviewLoadFailed'),
    retry,
  };
}

export interface TaskPreviewPages {
  preview: Record<never, never>;
  work: TaskInspectionAnchor;
  flow: Record<never, never>;
  requirement: { id: string } & TaskInspectionAnchor;
  evidence: TaskEvidenceParams;
  resource: { id: string };
}

export function TaskPreviewHeader(
  _: SecondaryScreenProps<TaskPreviewSecondaryData, TaskPreviewPages['preview']>,
) {
  const { t } = useTranslation();
  return (
    <WorkspaceHeaderIdentity
      headingLevel={2}
      title={t('specification.taskPreviewTitle')}
      icon="list-checks"
    />
  );
}

export function TaskPreviewScreen({
  data,
}: SecondaryScreenProps<TaskPreviewSecondaryData, TaskPreviewPages['preview']>) {
  const nav = useSecondaryStack<TaskPreviewPages>();
  return (
    <AppContent className="w-content-standard max-w-full">
      <AppWorkspaceBody padding="none">
        <TaskPreview
          task={data.task}
          groups={data.groups}
          specKey={data.specId}
          onOpenFull={data.openFullTask}
          onInspect={(page, id) => {
            if (page === 'requirement')
              void nav.navTo('requirement', { id: id!, ...inspectionAnchor(data.task.snapshot) });
            else if (page === 'work') void nav.navTo('work', inspectionAnchor(data.task.snapshot));
            else void nav.navTo('flow');
          }}
          onOpenResource={(resource) => {
            void nav.navTo('resource', { id: resource.id });
          }}
        />
      </AppWorkspaceBody>
    </AppContent>
  );
}

function WorkHeader({
  data,
}: SecondaryScreenProps<TaskPreviewSecondaryData, Record<never, never>>) {
  return <TaskContextHeader task={data.task} />;
}
function RequirementHeader({
  data,
  params,
}: SecondaryScreenProps<TaskPreviewSecondaryData, { id: string }>) {
  return <TaskContextHeader task={data.task} requirementId={params.id} />;
}
function PreviewWork({
  data,
  params,
}: SecondaryScreenProps<TaskPreviewSecondaryData, TaskInspectionAnchor>) {
  return (
    <AppContent className="w-content-standard max-w-full">
      <AppWorkspaceBody padding="none">
        <TaskInspection task={data.task} page="work" anchor={params} />
      </AppWorkspaceBody>
    </AppContent>
  );
}
function PreviewFlow({
  data,
}: SecondaryScreenProps<TaskPreviewSecondaryData, Record<never, never>>) {
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
}: SecondaryScreenProps<TaskPreviewSecondaryData, TaskEvidenceParams>) {
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
function PreviewRequirement({
  data,
  params,
}: SecondaryScreenProps<TaskPreviewSecondaryData, TaskPreviewPages['requirement']>) {
  const nav = useSecondaryStack<TaskPreviewPages>();
  return (
    <AppContent className="w-content-standard max-w-full">
      <AppWorkspaceBody padding="none">
        <TaskInspection
          task={data.task}
          page="requirement"
          requirementId={params.id}
          anchor={params}
          onOpenEvidence={(evidence) => {
            void nav.navTo('evidence', evidence);
          }}
        />
      </AppWorkspaceBody>
    </AppContent>
  );
}
function PreviewResource({
  data,
  params,
}: SecondaryScreenProps<TaskPreviewSecondaryData, { id: string }>) {
  const pages = useTaskResources(data.specId, data.task.id, data.task.snapshot);
  const section = data.task.snapshot?.sections.resources;
  const refs = mergeTaskResources(
    section?.state === 'available' ? section.data.recommended : [],
    pages.data?.pages.map((page) => page.items) ?? [],
  );
  return (
    <AppContent className="w-content-standard max-w-full">
      <AppWorkspaceBody padding="none">
        <div className="p-4">
          <TaskResourceInspection resource={refs.find((ref) => ref.id === params.id)} />
        </div>
      </AppWorkspaceBody>
    </AppContent>
  );
}

export const taskPreviewStack = defineSecondaryStack<
  { specId: string; taskId: string },
  TaskPreviewSecondaryData,
  TaskPreviewPages
>({
  id: 'specification-task-preview',
  initial: 'preview',
  useData: useTaskPreviewData,
  screens: {
    work: { title: 'Step details', header: WorkHeader, component: PreviewWork },
    flow: { title: 'Flow', header: TaskFlowHeader, component: PreviewFlow },
    requirement: {
      title: 'Requirement',
      header: RequirementHeader,
      component: PreviewRequirement,
    },
    evidence: { title: 'Evidence', header: TaskEvidenceHeader, component: EvidenceScreen },
    resource: { title: 'Resource', header: TaskResourceHeader, component: PreviewResource },
    preview: {
      title: 'Task preview',
      header: TaskPreviewHeader,
      actions: ({ data }): readonly WorkspaceHeaderAction[] => [
        {
          id: 'open-full',
          label: data.fullTaskLabel ?? appI18n.t('specification.fullTaskView'),
          icon: 'open-full',
          onPress: () => data.openFullTask(data.task.id),
        },
      ],
      component: TaskPreviewScreen,
    },
  },
});

export interface DocumentPreviewData {
  readonly fullDocumentLabel?: string;
  readonly specId: string;
  readonly documentId: string;
  readonly title: string;
  readonly openFullDocument?: (documentId: string) => void;
}
export interface DocumentPreviewPages {
  preview: Record<never, never>;
}
function useDocumentPreviewData({
  specId,
  documentId,
}: {
  specId: string;
  documentId: string;
}): SecondaryData<DocumentPreviewData> {
  const { t } = useTranslation();
  const context = useContext(SpecificationSecondaryDataContext);
  if (!context) return { status: 'loading' };
  const title = context.data.documents.find((item) => item.id === documentId)?.title ?? documentId;
  return {
    status: 'ready',
    data: {
      specId,
      documentId,
      title,
      fullDocumentLabel: t('specification.openFullDocument'),
      openFullDocument: context.openFullDocument,
    },
  };
}
function DocumentPreviewHeader({
  data,
}: SecondaryScreenProps<DocumentPreviewData, DocumentPreviewPages['preview']>) {
  return <WorkspaceHeaderIdentity headingLevel={2} title={data.title} subtitle={data.documentId} />;
}
function DocumentPreviewScreen({
  data,
}: SecondaryScreenProps<DocumentPreviewData, DocumentPreviewPages['preview']>) {
  return (
    <AppContent className="w-content-standard max-w-full">
      <AppWorkspaceBody padding="none">
        <DocumentContent specId={data.specId} documentId={data.documentId} />
      </AppWorkspaceBody>
    </AppContent>
  );
}
export const documentPreviewStack = defineSecondaryStack<
  { specId: string; documentId: string },
  DocumentPreviewData,
  DocumentPreviewPages
>({
  id: 'specification-document-preview',
  initial: 'preview',
  useData: useDocumentPreviewData,
  screens: {
    preview: {
      title: 'Document preview',
      header: DocumentPreviewHeader,
      actions: ({ data }): readonly WorkspaceHeaderAction[] =>
        data.openFullDocument
          ? [
              {
                id: 'open-full-document',
                label: data.fullDocumentLabel ?? appI18n.t('specification.openFullDocument'),
                icon: 'open-full',
                primary: true,
                onPress: () => data.openFullDocument?.(data.documentId),
              },
            ]
          : [],
      component: DocumentPreviewScreen,
    },
  },
});

export interface HistorySecondaryData {
  readonly specId: string;
  readonly events: readonly ActivityEvent[];
  readonly openTask: (taskId: string) => void;
  readonly openSession?: (sessionId: string) => void;
  readonly openDoc?: (docId: string) => void;
}

export function useHistoryData({
  specId,
}: {
  specId: string;
}): SecondaryData<HistorySecondaryData> {
  const context = useContext(SpecificationSecondaryDataContext);
  if (!context) {
    return { status: 'loading' };
  }
  return {
    status: 'ready',
    data: {
      specId,
      events: context.data.activityEvents,
      openTask: context.previewTask,
      openSession: context.openSession,
      openDoc: context.openDoc,
    },
  };
}

export interface HistoryPages {
  history: Record<never, never>;
}

export function ActivityHistoryHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeaderIdentity
      headingLevel={2}
      icon="clock"
      title={t('specification.activityHistory')}
      subtitle={t('specification.thisSpecification')}
    />
  );
}

export function ActivityHistoryScreen({
  data,
}: SecondaryScreenProps<HistorySecondaryData, HistoryPages['history']>) {
  const nav = useSecondaryStack<HistoryPages>();
  return (
    <AppContent className="w-content-standard max-w-full">
      <AppWorkspaceBody padding="none">
        <ActivityHistory
          showHeading={false}
          events={data.events}
          isExplicit={true}
          onOpenTask={(taskId) => {
            void nav.navTo(taskPreviewStack, { specId: data.specId, taskId });
          }}
          onOpenSession={data.openSession}
          onOpenDoc={data.openDoc}
        />
      </AppWorkspaceBody>
    </AppContent>
  );
}

export const historyStack = defineSecondaryStack<
  { specId: string },
  HistorySecondaryData,
  HistoryPages
>({
  id: 'specification-history',
  initial: 'history',
  useData: useHistoryData,
  screens: {
    history: {
      title: 'Activity history',
      header: ActivityHistoryHeader,
      component: ActivityHistoryScreen,
    },
  },
});
