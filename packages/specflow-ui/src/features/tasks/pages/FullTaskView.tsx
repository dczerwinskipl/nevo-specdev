import { Icon, Timeline, Typography } from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import type { FullTaskData } from '../model';
import { taskStatusLabel } from '../status';

export interface FullTaskViewProps {
  readonly task: FullTaskData;
  readonly specKey: string;
  readonly onBack: () => void;
  readonly backHref?: string;
  readonly onOpenSession?: (sessionId: string) => void;
}

export function FullTaskView({
  task,
  specKey,
  onBack,
  backHref,
  onOpenSession,
}: FullTaskViewProps) {
  const { t } = useTranslation();

  return (
    <div className="grid max-w-content-standard gap-6 py-2">
      {backHref ? (
        <a
          href={backHref}
          onClick={(event) => {
            if (
              event.button === 0 &&
              !event.metaKey &&
              !event.ctrlKey &&
              !event.shiftKey &&
              !event.altKey
            ) {
              event.preventDefault();
              onBack();
            }
          }}
          className="flex w-fit items-center gap-2 text-body-sm font-medium text-accent-primary hover:underline focus-visible:outline-2 focus-visible:outline-focus-ring"
        >
          <Icon name="arrow-right" size="sm" className="rotate-180" />
          <span>{t('specification.backToSpecification')}</span>
        </a>
      ) : (
        <button
          type="button"
          onClick={onBack}
          className="flex w-fit items-center gap-2 text-body-sm font-medium text-accent-primary hover:underline focus-visible:outline-2 focus-visible:outline-focus-ring"
        >
          <Icon name="arrow-right" size="sm" className="rotate-180" />
          <span>{t('specification.backToSpecification')}</span>
        </button>
      )}

      <div>
        <p className="font-mono text-body-xs text-content-muted">
          {task.id} · {specKey}
        </p>
        <Typography
          as="h2"
          variant="title-md"
          className="mt-1 font-semibold text-content-primary [overflow-wrap:anywhere]"
        >
          {task.title}
        </Typography>
        <p className="mt-1 text-body-sm text-content-secondary">
          {taskStatusLabel(task, t)}
          {task.additionalInfo ? ` · ${task.additionalInfo}` : ''}
        </p>
      </div>

      <article className="grid gap-6 border-t border-border-subtle pt-6 leading-relaxed text-content-secondary">
        {task.purpose ? (
          <div>
            <Typography as="h3" variant="title-sm" className="font-medium text-content-primary">
              {t('specification.taskFullPurposeHeading')}
            </Typography>
            <p className="mt-1 text-body-sm">{task.purpose}</p>
          </div>
        ) : null}

        {task.acceptanceCriteria && task.acceptanceCriteria.length > 0 ? (
          <div>
            <Typography as="h3" variant="title-sm" className="font-medium text-content-primary">
              {t('specification.taskFullAcceptanceHeading')}
            </Typography>
            <ul className="mt-1.5 list-disc pl-5 text-body-sm grid gap-1">
              {task.acceptanceCriteria.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {task.workflow ? (
          <div>
            <Typography as="h3" variant="title-sm" className="font-medium text-content-primary">
              {t('specification.taskFullWorkflowHeading')}
            </Typography>
            <p className="mt-1 text-body-sm">{task.workflow}</p>
          </div>
        ) : null}

        {task.evidence && task.evidence.length > 0 ? (
          <div>
            <Typography as="h3" variant="title-sm" className="font-medium text-content-primary">
              {t('specification.taskFullEvidenceHeading')}
            </Typography>
            <div className="mt-2 flex flex-wrap gap-4 text-body-sm">
              {task.evidence.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    if (item.href) window.open(item.href, '_blank', 'noopener,noreferrer');
                  }}
                  className="text-left font-medium text-accent-primary hover:underline focus-visible:outline-2 focus-visible:outline-focus-ring"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {onOpenSession && task.relatedSessions && task.relatedSessions.length > 0 ? (
          <div>
            <Typography as="h3" variant="title-sm" className="font-medium text-content-primary">
              {t('specification.taskFullRelatedSessionsHeading')}
            </Typography>
            <div className="mt-2 grid gap-2">
              {task.relatedSessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => onOpenSession(session.id)}
                  className="w-fit text-left text-body-sm font-medium text-accent-primary hover:underline focus-visible:outline-2 focus-visible:outline-focus-ring"
                >
                  {session.title}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {task.history && task.history.length > 0 ? (
          <div>
            <Typography as="h3" variant="title-sm" className="font-medium text-content-primary">
              {t('specification.taskFullHistoryHeading')}
            </Typography>
            <Timeline size="sm" className="mt-3">
              {task.history.map((h, idx) => (
                <Timeline.Item key={idx}>
                  <Timeline.Marker tone="neutral" />
                  <Timeline.Content title={h} />
                </Timeline.Item>
              ))}
            </Timeline>
          </div>
        ) : null}
      </article>
    </div>
  );
}
