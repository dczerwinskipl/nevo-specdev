import { Button, InformationList, Typography } from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import type { SessionSummary } from '../../specs/workspace/model';
import { sessionActivityLabel } from '../../specs/workspace/status-labels';
import { OperationalRow } from '../../specs/shared/OperationalList';

export interface SessionsViewProps {
  readonly sessions: readonly SessionSummary[];
  readonly onOpenSession?: (id: string) => void;
  readonly onNewConversation?: () => void;
}

export function SessionsView({ sessions, onOpenSession, onNewConversation }: SessionsViewProps) {
  const { t } = useTranslation();

  return (
    <div className="grid max-w-content-standard gap-6 py-2">
      <div className="flex items-center justify-between gap-4">
        <Typography as="h2" variant="title-md" className="font-semibold text-content-primary">
          {t('specification.sessionsOfThisSpec')}
        </Typography>

        <Button
          leadingIcon="chat-plus"
          disabled={!onNewConversation}
          title={!onNewConversation ? t('common.notImplemented') : undefined}
          onClick={onNewConversation}
        >
          {t('specification.newConversation')}
        </Button>
      </div>

      <InformationList>
        {sessions.map((session) => {
          const supporting = session.activity
            ? {
                text: sessionActivityLabel(session, t),
                tone: session.activity.tone ?? 'neutral',
                icon: session.activity.icon,
                iconClassName: session.activity.animate ? 'animate-spin' : undefined,
              }
            : session.meta
              ? { text: session.meta }
              : undefined;

          const compactFacts: [string, string] = [session.taskCount ?? '', session.age ?? ''];

          return (
            <OperationalRow
              key={session.id}
              primary={session.title}
              onPrimaryClick={onOpenSession ? () => onOpenSession(session.id) : undefined}
              compactFacts={compactFacts}
              supporting={supporting}
            />
          );
        })}
      </InformationList>

      <Typography variant="body-sm" className="text-content-muted">
        {t('specification.sessionsFutureNotice')}
      </Typography>
    </div>
  );
}
