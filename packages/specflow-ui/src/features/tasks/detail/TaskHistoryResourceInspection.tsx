import { Typography } from '@nevo/ui';
import type { TaskSnapshot } from '@nevo/specflow-contracts/specs/workspace';
import { useTranslation } from 'react-i18next';
import { useTaskHistory } from './useTaskPages';
import { TaskSourceState } from './TaskDetails';
import { TaskResourceInspection } from './TaskInspection';

export interface TaskHistoryResourceParams {
  readonly entryId: string;
  readonly resourceId: string;
  readonly token: string;
  readonly revision: string;
}

export function TaskHistoryResourceInspection({
  specId,
  taskId,
  snapshot,
  params,
}: {
  readonly specId: string;
  readonly taskId: string;
  readonly snapshot?: TaskSnapshot;
  readonly params: TaskHistoryResourceParams;
}) {
  const { t } = useTranslation();
  const query = useTaskHistory(specId, taskId, snapshot);
  const section = snapshot?.sections.history;
  if (query.accessDenied || section?.state === 'forbidden')
    return <TaskSourceState state="forbidden" />;
  if (section?.state !== 'available' || !query.readerAvailable)
    return <TaskSourceState state="unavailable" />;
  if (snapshot?.revision !== params.revision || section.data.token !== params.token)
    return (
      <Typography as="p" variant="body-sm" role="status">
        {t('taskDetails.contextChanged')}
      </Typography>
    );
  if (query.isPending)
    return (
      <Typography as="p" variant="body-sm">
        {t('common.loading')}
      </Typography>
    );
  const entry = query.data?.pages
    .filter((page) => page.token === params.token)
    .flatMap((page) => page.items)
    .find((item) => item.id === params.entryId);
  return (
    <TaskResourceInspection
      resource={entry?.resources.find((item) => item.id === params.resourceId)}
    />
  );
}
