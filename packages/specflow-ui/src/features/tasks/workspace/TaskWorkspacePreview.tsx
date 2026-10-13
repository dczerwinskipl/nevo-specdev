import { Badge, Button, Icon, Typography } from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import type { TaskWorkspaceData } from './taskWorkspaceModel';

export function TaskWorkspacePreview({
  data,
  onOpenTask,
}: {
  readonly data: TaskWorkspaceData;
  readonly onOpenTask: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid min-w-0 gap-3 p-4">
      <Typography as="h2" variant="title-md" className="[overflow-wrap:anywhere]">
        {data.title}
      </Typography>
      {data.description ? (
        <Typography as="p" variant="body-md">
          {data.description}
        </Typography>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Typography as="span" variant="body-md">
          {t('taskWorkspace.status')}:
        </Typography>
        <Badge tone={data.status.tone}>
          <span className="inline-flex min-w-0 items-center gap-1">
            <Icon name={data.status.icon} size="sm" />
            {data.status.label}
          </span>
        </Badge>
      </div>
      {data.step && data.phase !== 'completed' ? (
        <Typography as="p" variant="body-md">
          {t(
            data.phase === 'ready' || data.phase === 'waiting'
              ? 'taskWorkspace.nextStep'
              : 'taskWorkspace.step',
          )}
          : {data.step.name}
          {data.step.attempt !== undefined && data.phase !== 'ready' && data.phase !== 'waiting'
            ? ` · ${t('taskWorkspace.attempt', { count: data.step.attempt })}`
            : ''}
        </Typography>
      ) : null}
      <Button variant="secondary" size="sm" onClick={onOpenTask} className="justify-self-start">
        {t('taskWorkspace.openTask')}
      </Button>
    </div>
  );
}
