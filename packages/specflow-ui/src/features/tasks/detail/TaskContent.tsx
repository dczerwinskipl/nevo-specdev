import { DocumentContent } from '../../documents/connected/DocumentContent';
import { TaskDetails, type TaskDetailsProps } from './TaskDetails';
import { useTaskResources } from './useTaskPages';

export function TaskContent(props: TaskDetailsProps) {
  const snapshot = props.task.snapshot;
  const resources = useTaskResources(props.specKey, props.task.id, snapshot);
  const document = snapshot?.sections.document;
  const ref = document?.state === 'available' ? document.data : undefined;
  return (
    <TaskDetails
      {...props}
      task={
        resources.accessDenied && snapshot
          ? {
              ...props.task,
              snapshot: {
                ...snapshot,
                sections: { ...snapshot.sections, resources: { state: 'forbidden' } },
              },
            }
          : props.task
      }
      resources={resources.data?.pages.flatMap((page) => page.items)}
      resourcesLoading={resources.isFetching}
      resourcesError={resources.isError}
      onLoadResources={
        resources.readerAvailable
          ? () => {
              void (resources.isError ? resources.retryPage() : resources.fetchNextPage());
            }
          : undefined
      }
      renderDocument={
        ref
          ? () => (
              <DocumentContent
                specId={props.specKey}
                documentId={ref.id}
                expectedRevision={ref.revision}
                omitTitle={props.task.title}
              />
            )
          : undefined
      }
    />
  );
}
