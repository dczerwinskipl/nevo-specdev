import type { ReactNode } from 'react';
import { Timeline, type TimelineTone } from '@nevo/ui';

export interface ActivityTimelineItemProps {
  readonly tone: TimelineTone;
  readonly active?: boolean;
  readonly title: ReactNode;
  readonly time?: string;
  readonly description?: ReactNode;
}

/**
 * Domain-neutral visual item primitive wrapping Nevo UI Timeline components.
 */
export function ActivityTimelineItem({
  tone,
  active = false,
  title,
  time,
  description,
}: ActivityTimelineItemProps) {
  return (
    <Timeline.Item>
      <Timeline.Marker tone={tone} active={active} />
      <Timeline.Content title={title} time={time} description={description} />
    </Timeline.Item>
  );
}
