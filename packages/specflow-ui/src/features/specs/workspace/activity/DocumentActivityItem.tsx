import { useTranslation } from 'react-i18next';
import { ActivityTimelineItem } from './ActivityTimelineItem';
import type { DocumentActivityEvent } from './model';

export interface DocumentActivityItemProps {
  readonly event: DocumentActivityEvent;
  readonly active?: boolean;
  readonly onOpenDoc?: (docId: string) => void;
}

export function DocumentActivityItem({ event, active, onOpenDoc }: DocumentActivityItemProps) {
  const { t } = useTranslation();

  const titleNode = onOpenDoc ? (
    <button
      type="button"
      onClick={() => onOpenDoc(event.targetId)}
      className="text-left text-content-primary hover:text-accent-primary hover:underline focus-visible:outline-2 focus-visible:outline-focus-ring [overflow-wrap:anywhere]"
      aria-label={t('specification.readDocAria', { title: event.title })}
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
