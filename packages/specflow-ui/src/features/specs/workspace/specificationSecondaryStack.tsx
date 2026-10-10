import { createContext, useContext } from 'react';
import {
  AppContent,
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
import { TaskPreview } from '../../tasks/inspectors/TaskPreview';
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
  const context = useContext(SpecificationSecondaryDataContext);
  const listTask = context?.data.taskGroups
    .flatMap((group) => group.tasks)
    .find((task) => task.id === taskId);
  // Attention/Activity may reference a Task absent from the current Workspace projection.
  const detail = useSpecificationTask(specId, taskId, undefined, Boolean(context) && !listTask);
  if (!context) return { status: 'loading' };

  let task: TaskItem;
  if (listTask) {
    task = listTask;
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
      id: taskId,
      title: detailTask.title,
      status: detailTask.status.lifecycle,
      statusCode: detailTask.status.lifecycle,
      lifecycle: detailTask.status.lifecycle,
      group: '',
    };
  }

  return {
    status: 'ready',
    data: {
      specId,
      task,
      groups: context.data.taskGroups,
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
}

export function TaskPreviewHeader({
  data,
}: SecondaryScreenProps<TaskPreviewSecondaryData, TaskPreviewPages['preview']>) {
  const { t } = useTranslation();
  return (
    <WorkspaceHeaderIdentity
      headingLevel={2}
      title={t('specification.taskPreviewTitle')}
      subtitle={`${data.task.id} · ${data.task.title}`}
    />
  );
}

export function TaskPreviewScreen({
  data,
}: SecondaryScreenProps<TaskPreviewSecondaryData, TaskPreviewPages['preview']>) {
  return (
    <AppContent>
      <TaskPreview
        task={data.task}
        groups={data.groups}
        specKey={data.specId}
        onOpenFull={data.openFullTask}
      />
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
    preview: {
      title: 'Task preview',
      header: TaskPreviewHeader,
      actions: ({ data }): readonly WorkspaceHeaderAction[] => [
        {
          id: 'open-full',
          label: appI18n.t('specification.fullTaskView'),
          icon: 'open-full',
          primary: true,
          onPress: () => data.openFullTask(data.task.id),
        },
      ],
      component: TaskPreviewScreen,
    },
  },
});

export interface DocumentPreviewData {
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
  const context = useContext(SpecificationSecondaryDataContext);
  if (!context) return { status: 'loading' };
  const title = context.data.documents.find((item) => item.id === documentId)?.title ?? documentId;
  return {
    status: 'ready',
    data: { specId, documentId, title, openFullDocument: context.openFullDocument },
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
    <AppContent>
      <DocumentContent specId={data.specId} documentId={data.documentId} />
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
                label: appI18n.t('specification.openFullDocument'),
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
    <AppContent>
      <ActivityHistory
        events={data.events}
        isExplicit={true}
        onOpenTask={(taskId) => {
          void nav.navTo(taskPreviewStack, { specId: data.specId, taskId });
        }}
        onOpenSession={data.openSession}
        onOpenDoc={data.openDoc}
      />
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
