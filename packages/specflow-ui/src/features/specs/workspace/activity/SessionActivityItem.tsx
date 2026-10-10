import { useTranslation } from 'react-i18next';
import { ActivityTimelineItem } from './ActivityTimelineItem';
import type { SessionActivityEvent } from './model';

export interface SessionActivityItemProps {
  readonly event: SessionActivityEvent;
  readonly active?: boolean;
  readonly onOpenSession?: (sessionId: string) => void;
}

export function SessionActivityItem({ event, active, onOpenSession }: SessionActivityItemProps) {
  const { t } = useTranslation();

  const titleNode = onOpenSession ? (
    <button
      type="button"
      onClick={() => onOpenSession(event.targetId)}
      className="text-left text-content-primary hover:text-accent-primary hover:underline focus-visible:outline-2 focus-visible:outline-focus-ring [overflow-wrap:anywhere]"
      aria-label={t('specification.openSessionAria', { title: event.title })}
    >
      {event.title}
    </button>
  ) : (
    <span className="[overflow-wrap:anywhere]">{event.title}</span>
  );

  return (
    <ActivityTimelineItem
      tone="info"
      active={active}
      title={titleNode}
      time={event.time}
      description={event.description}
    />
  );
}
