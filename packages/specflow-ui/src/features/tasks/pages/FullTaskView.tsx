import { Button, Link } from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import type { FullTaskData } from '../model';
import { TaskDetails } from '../detail/TaskDetails';

export interface FullTaskViewProps {
  readonly task: FullTaskData;
  readonly specKey: string;
  readonly onBack: () => void;
  readonly backHref?: string;
  readonly onOpenSession?: (sessionId: string) => void;
  readonly children?: ReactNode;
}
export function FullTaskView({ task, specKey, onBack, backHref, children }: FullTaskViewProps) {
  const { t } = useTranslation();
  return (
    <div className="grid min-w-0 max-w-content-standard gap-4">
      {backHref ? (
        <Link
          href={backHref}
          className="w-fit"
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
          {t('specification.backToSpecification')}
        </Link>
      ) : (
        <Button variant="ghost" size="sm" className="w-fit" onClick={onBack}>
          {t('specification.backToSpecification')}
        </Button>
      )}
      {children ?? <TaskDetails task={task} specKey={specKey} />}
    </div>
  );
}
