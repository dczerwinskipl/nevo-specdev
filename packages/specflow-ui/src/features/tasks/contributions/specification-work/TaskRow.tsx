import { Checkbox, MenuItem, OverflowMenu } from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import { OperationalRow } from '../../../specs/shared/OperationalList';
import type { TaskItem } from '../../model';
import { getTaskStatePresentation } from './presentation';
import { taskStatusLabel } from '../../status';

export interface TaskRowProps {
  readonly task: TaskItem;
  readonly selected: boolean;
  readonly isPreparing?: boolean;
  readonly onSelect: (id: string, selected: boolean) => void;
  readonly onPreview: (id: string) => void;
  readonly fullTaskHref: string;
}

export function TaskRow({
  task,
  selected,
  isPreparing = false,
  onSelect,
  onPreview,
  fullTaskHref,
}: TaskRowProps) {
  const { t } = useTranslation();
  const statePresentation = getTaskStatePresentation(task);

  const leading = (
    <div
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      className="flex items-center justify-center"
    >
      <Checkbox
        aria-label={t('specification.selectTask', { id: task.id })}
        checked={selected}
        disabled={isPreparing}
        onCheckedChange={(checked) => onSelect(task.id, checked === true)}
      />
    </div>
  );

  const trailing = (
    <OverflowMenu
      label={task.id}
      triggerLabel={t('specification.taskActionsNamed', { id: task.id })}
    >
      <MenuItem
        leadingIcon="open-full"
        onSelect={() => {
          window.open(fullTaskHref, '_blank', 'noopener,noreferrer');
        }}
      >
        {t('specification.openTaskNewWindow')}
      </MenuItem>
    </OverflowMenu>
  );

  return (
    <OperationalRow
      titleAs="span"
      primary={task.title}
      onPrimaryClick={() => onPreview(task.id)}
      primaryAriaLabel={task.title}
      compactFacts={[{ text: task.id, mono: true }, taskStatusLabel(task, t)]}
      supporting={
        task.additionalInfo
          ? {
              text: task.additionalInfo,
              tone: statePresentation.tone,
              icon: statePresentation.icon,
              iconClassName: statePresentation.iconClassName,
              textClassName: statePresentation.textClassName,
            }
          : undefined
      }
      leading={leading}
      trailing={trailing}
      selected={selected}
      dataAttributes={{
        'data-row-task': task.id,
        'data-task-title': 'true',
        'data-task-key': task.id,
        'data-task-status': task.statusCode ?? task.status,
      }}
    />
  );
}
