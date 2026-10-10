import { Button, Icon, Timeline, Typography } from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import type { ActivityEvent } from '../model';
import { TaskActivityItem } from './TaskActivityItem';
import { SessionActivityItem } from './SessionActivityItem';
import { DocumentActivityItem } from './DocumentActivityItem';
import { InformationalActivityItem } from './InformationalActivityItem';

export interface ActivityHistoryProps {
  readonly events: readonly ActivityEvent[];
  readonly isExplicit?: boolean;
  readonly onClose?: () => void;
  readonly onOpenTask?: (taskId: string) => void;
  readonly onOpenSession?: (sessionId: string) => void;
  readonly onOpenDoc?: (docId: string) => void;
}

export function ActivityHistory({
  events,
  isExplicit = false,
  onClose,
  onOpenTask,
  onOpenSession,
  onOpenDoc,
}: ActivityHistoryProps) {
  const { t } = useTranslation();

  return (
    <aside
      className="flex h-full flex-col overflow-y-auto p-5"
      aria-label={t('specification.historyAriaLabel')}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <Typography
            as="h3"
            variant="title-sm"
            className="flex items-center gap-2 text-content-primary"
          >
            <Icon name="clock" size="sm" className="text-content-muted" />
            <span>{t('specification.activityHistory')}</span>
          </Typography>
          <Typography variant="body-sm" className="mt-0.5 text-content-muted">
            {t('specification.thisSpecification')}
          </Typography>
        </div>

        {isExplicit && onClose ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label={t('specification.backFromHistory')}
          >
            {t('navigation.back')}
          </Button>
        ) : null}
      </div>

      <Timeline size="md">
        {events.map((event, index) => {
          const active = index === 0;

          switch (event.kind) {
            case 'task':
              return (
                <TaskActivityItem
                  key={event.id}
                  event={event}
                  active={active}
                  onOpenTask={onOpenTask}
                />
              );
            case 'session':
              return (
                <SessionActivityItem
                  key={event.id}
                  event={event}
                  active={active}
                  onOpenSession={onOpenSession}
                />
              );
            case 'doc':
              return (
                <DocumentActivityItem
                  key={event.id}
                  event={event}
                  active={active}
                  onOpenDoc={onOpenDoc}
                />
              );
            case 'info':
              return <InformationalActivityItem key={event.id} event={event} active={active} />;
            default: {
              const _exhaustive: never = event;
              void _exhaustive;
              return null;
            }
          }
        })}
      </Timeline>
    </aside>
  );
}
