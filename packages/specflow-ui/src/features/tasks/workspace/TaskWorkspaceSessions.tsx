import { Badge, Button, Icon, InformationList, iconButtonVariants } from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import { useId } from 'react';
import { WorkspaceSection } from '../../specs/workspace/sections/WorkspaceSection';
import {
  OperationalRow,
  operationalPrimaryLinkClassName,
} from '../../specs/shared/OperationalList';
import { useTaskWorkspace } from './TaskWorkspaceState';
import { SessionProviderIcon } from '../../sessions/shared/SessionProviderIcon';

export function TaskWorkspaceSessions() {
  const { t } = useTranslation();
  const listId = useId();
  const { data, allSessions, setAllSessions } = useTaskWorkspace();
  if (!data.sessions.length) return null;
  // Stable grouping preserves the explicit newest-first ordering within each association.
  const sessions = [
    ...data.sessions.filter((s) => s.current),
    ...data.sessions.filter((s) => !s.current),
  ];
  return (
    <WorkspaceSection aria-label={t('taskWorkspace.sessions')}>
      <WorkspaceSection.Header
        title={t('taskWorkspace.sessions')}
        icon="chat"
        count={sessions.length}
        headingTag="h2"
      />
      <InformationList id={listId}>
        {(allSessions ? sessions : sessions.slice(0, 3)).map((session) => {
          const label = t('taskWorkspace.openSession', {
            title: session.title,
            step: session.step,
            attempt: session.attempt,
          });
          return (
            <OperationalRow
              key={session.id}
              primary={session.title}
              leading={<SessionProviderIcon providerId={session.providerId} />}
              primaryLink={
                session.href ? (
                  <a
                    href={session.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className={operationalPrimaryLinkClassName}
                  >
                    {session.title}
                  </a>
                ) : undefined
              }
              compactFacts={session.role ? [session.provider, session.role] : [session.provider]}
              supporting={`${t(session.current ? 'taskWorkspace.currentExecution' : 'taskWorkspace.previousExecution')} · ${session.step} · ${t('taskWorkspace.attempt', { count: session.attempt })}${session.href ? '' : ` · ${t('taskWorkspace.sessionUnavailable')}`}`}
              metadata={
                <Badge
                  tone={
                    session.status === 'running'
                      ? 'info'
                      : session.status === 'waitingForUser'
                        ? 'attention'
                        : 'neutral'
                  }
                >
                  {t(`taskWorkspace.sessionStatus.${session.status}`)}
                </Badge>
              }
              trailing={
                session.href ? (
                  <a
                    href={session.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    title={label}
                    className={`pointer-events-auto ${iconButtonVariants({ size: 'sm' })}`}
                  >
                    <Icon name="open-full" size="sm" />
                  </a>
                ) : undefined
              }
            />
          );
        })}
      </InformationList>
      {sessions.length > 3 ? (
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={allSessions}
          aria-controls={listId}
          onClick={() => setAllSessions(!allSessions)}
        >
          {allSessions
            ? t('taskWorkspace.lessSessions')
            : t('taskWorkspace.allSessions', { count: sessions.length })}
        </Button>
      ) : null}
    </WorkspaceSection>
  );
}
