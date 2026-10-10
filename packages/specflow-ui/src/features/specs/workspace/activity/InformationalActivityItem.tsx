import { ActivityTimelineItem } from './ActivityTimelineItem';
import type { InformationalActivityEvent } from './model';

export interface InformationalActivityItemProps {
  readonly event: InformationalActivityEvent;
  readonly active?: boolean;
}

export function InformationalActivityItem({ event, active }: InformationalActivityItemProps) {
  return (
    <ActivityTimelineItem
      tone="neutral"
      active={active}
      title={<span className="[overflow-wrap:anywhere]">{event.title}</span>}
      time={event.time}
      description={event.description}
    />
  );
}
