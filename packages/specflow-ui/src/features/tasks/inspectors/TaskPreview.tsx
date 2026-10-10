import { Button, IconButton, Typography } from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import type { TaskGroup, TaskItem } from '../model';
import { taskStatusLabel } from '../status';

export interface TaskPreviewProps {
  readonly task: TaskItem;
  readonly groups: readonly TaskGroup[];
  readonly specKey: string;
  readonly onClose?: () => void;
  readonly onOpenFull: (taskId: string) => void;
}

export function TaskPreview({ task, groups, specKey, onClose, onOpenFull }: TaskPreviewProps) {
  const { t } = useTranslation();
  const group = groups.find(
    (g) => g.id === task.group || g.tasks.some((item) => item.id === task.id),
  );

  return (
    <aside
      className="flex h-full flex-col overflow-y-auto p-5"
      aria-label={t('specification.taskPreviewAriaLabel')}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Typography variant="body-sm" className="font-mono text-content-muted">
            {task.id}
          </Typography>
          <Typography
            as="h3"
            variant="title-sm"
            className="mt-1 font-semibold text-content-primary [overflow-wrap:anywhere]"
          >
            {task.title}
          </Typography>
        </div>

        {onClose ? (
          <IconButton
            icon="close"
            size="sm"
            variant="ghost"
            onClick={onClose}
            aria-label={t('specification.closeTaskPreview')}
          />
        ) : null}
      </div>

      <Typography variant="body-sm" className="text-content-secondary">
        {t('specification.defaultTaskPreviewDescription')}
      </Typography>

      <div className="my-5 grid gap-3 border-y border-border-subtle py-4 text-body-xs">
        <div>
          <span className="font-medium text-content-secondary">
            {t('specification.taskStateLabel')}
          </span>
          <p className="mt-0.5 text-content-muted">{taskStatusLabel(task, t)}</p>
        </div>
        {group?.name || task.group ? (
          <div>
            <span className="font-medium text-content-secondary">
              {t('specification.taskGroupLabel')}
            </span>
            <p className="mt-0.5 text-content-muted">{group?.name ?? task.group}</p>
          </div>
        ) : null}
        <div>
          <span className="font-medium text-content-secondary">
            {t('specification.taskContextLabel')}
          </span>
          <p className="mt-0.5 text-content-muted">
            {specKey} · {t('specification.thisSpecification')}
          </p>
        </div>
      </div>

      <div className="mt-auto pt-2">
        <Button
          variant="secondary"
          className="w-full"
          leadingIcon="open-full"
          onClick={() => onOpenFull(task.id)}
        >
          {t('specification.fullTaskView')}
        </Button>
      </div>
    </aside>
  );
}
