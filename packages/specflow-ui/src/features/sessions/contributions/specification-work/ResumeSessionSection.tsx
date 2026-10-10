import { InformationList, MenuItem, OverflowMenu } from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import { OperationalRow } from '../../../specs/shared/OperationalList';
import type { CompactFacts } from '../../../specs/shared/OperationalList/OperationalRow.types';
import type { SessionSummary } from '../../../specs/workspace/model';
import { sessionActivityLabel } from '../../../specs/workspace/status-labels';
import { WorkspaceSection } from '../../../specs/workspace/sections/WorkspaceSection';

export interface ResumeSessionSectionProps {
  readonly session: SessionSummary;
  readonly onOpenSession: (sessionId: string) => void;
  readonly onOpenSessionsView: () => void;
  readonly onStartConversation: () => void;
  readonly canStartConversation: boolean;
  readonly canOpenSession: boolean;
}

function sessionFacts({ taskCount, age }: SessionSummary): CompactFacts {
  if (taskCount && age) return [taskCount, age];
  if (taskCount) return [taskCount];
  if (age) return [age];
  return [];
}

export function ResumeSessionSection({
  session,
  onOpenSession,
  onOpenSessionsView,
  onStartConversation,
  canStartConversation,
  canOpenSession,
}: ResumeSessionSectionProps) {
  const { t } = useTranslation();

  return (
    <WorkspaceSection aria-labelledby="resume-heading">
      <WorkspaceSection.Header
        id="resume-heading"
        title={t('specification.continueSessionHeading')}
        icon="chat"
        actions={
          <OverflowMenu
            label={t('specification.continueSessionHeading')}
            triggerLabel={t('specification.sessionActions')}
            disabled={!canStartConversation}
            title={!canStartConversation ? t('common.notImplemented') : undefined}
          >
            <MenuItem
              leadingIcon="plus"
              disabled={!canStartConversation}
              onSelect={() => onStartConversation()}
            >
              {t('specification.newConversation')}
            </MenuItem>
          </OverflowMenu>
        }
      />

      <InformationList>
        <OperationalRow
          titleAs="span"
          primary={session.title}
          onPrimaryClick={canOpenSession ? () => onOpenSession(session.id) : undefined}
          compactFacts={sessionFacts(session)}
          supporting={
            session.activity
              ? {
                  text: sessionActivityLabel(session, t),
                  tone: session.activity.tone ?? 'neutral',
                  icon: session.activity.icon,
                  iconClassName: session.activity.animate ? 'animate-spin' : undefined,
                }
              : session.meta
                ? { text: session.meta }
                : undefined
          }
        />
      </InformationList>

      <WorkspaceSection.Footer>
        <WorkspaceSection.Continuation onClick={onOpenSessionsView}>
          {t('specification.allSessionsLink')}
        </WorkspaceSection.Continuation>
      </WorkspaceSection.Footer>
    </WorkspaceSection>
  );
}
