import type { ReactNode } from 'react';
import type { FullTaskData } from '../model';
import { TaskDetails } from '../detail/TaskDetails';
import { Icon, Typography } from '@nevo/ui';
import { useRouter } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
export interface FullTaskViewProps {
  readonly task: FullTaskData;
  readonly specKey: string;
  readonly onBack: () => void;
  readonly backHref?: string;
  readonly onOpenSession?: (sessionId: string) => void;
  readonly children?: ReactNode;
}
export function FullTaskView({ task, specKey, children, onBack, backHref }: FullTaskViewProps) {
  const router = useRouter({ warn: false });
  const { t } = useTranslation();
  const content = (
    <>
      <Icon name="arrow-right" size="sm" className="rotate-180" />
      {t('specification.backToSpecification')}
    </>
  );
  const className =
    'inline-flex items-center gap-1.5 text-content-secondary outline-none focus-visible:outline-2 focus-visible:outline-focus-ring';
  return (
    <div className="grid min-w-0 max-w-content-standard gap-4">
      {!router?.state.matches.some((match) => match.routeId.startsWith('/_app/')) ? (
        <Typography as="div" variant="body-sm">
          {backHref ? (
            <a
              href={backHref}
              className={className}
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
            >
              {content}
            </a>
          ) : (
            <button type="button" className={className} onClick={onBack}>
              {content}
            </button>
          )}
        </Typography>
      ) : null}
      {children ?? <TaskDetails task={task} specKey={specKey} />}
    </div>
  );
}
