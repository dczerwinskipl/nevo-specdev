import { useTranslation } from 'react-i18next';
import { ActivityTimelineItem } from './ActivityTimelineItem';
import type { TaskActivityEvent } from './model';

export interface TaskActivityItemProps {
  readonly event: TaskActivityEvent;
  readonly active?: boolean;
  readonly onOpenTask?: (taskId: string) => void;
}

export function TaskActivityItem({ event, active, onOpenTask }: TaskActivityItemProps) {
  const { t } = useTranslation();

  const titleNode = onOpenTask ? (
    <button
      type="button"
      onClick={() => onOpenTask(event.targetId)}
      className="text-left text-content-primary hover:text-accent-primary hover:underline focus-visible:outline-2 focus-visible:outline-focus-ring [overflow-wrap:anywhere]"
      aria-label={t('specification.previewTaskAria', { title: event.title })}
    >
      {event.title}
    </button>
  ) : (
    <span className="[overflow-wrap:anywhere]">{event.title}</span>
  );

  return (
    <ActivityTimelineItem
      tone="neutral"
      active={active}
      title={titleNode}
      time={event.time}
      description={event.description}
    />
  );
}
