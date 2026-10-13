import { useId, useState, type ReactNode } from 'react';
import { Button, Typography } from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import { useTaskViewState } from './TaskViewState';

/** Product inspection depth; only expansion flags survive a keyed document round trip. */
export function TaskDetailDisclosure({
  label,
  hideLabel,
  children,
  taskId,
  stateKey,
  headingLevel,
}: {
  readonly label: string;
  readonly hideLabel: string;
  readonly children: ReactNode;
  readonly taskId?: string;
  readonly stateKey?: string;
  readonly headingLevel?: 4;
}) {
  const id = useId();
  const [localExpanded, setLocalExpanded] = useState(false);
  const { state, update } = useTaskViewState(taskId ?? '');
  const expanded = taskId && stateKey ? !!state.inspectionDisclosures?.[stateKey] : localExpanded;
  const trigger = (
    <Button
      variant="ghost"
      size="sm"
      aria-expanded={expanded}
      aria-controls={id}
      onClick={(event) => {
        if (taskId && stateKey)
          update((previous) => ({
            inspectionDisclosures: { ...previous.inspectionDisclosures, [stateKey]: !expanded },
          }));
        else setLocalExpanded(!expanded);
        event.currentTarget.focus({ preventScroll: true });
      }}
    >
      {expanded ? hideLabel : label}
    </Button>
  );
  return (
    <div className="pointer-events-auto grid min-w-0 justify-items-start gap-1">
      {headingLevel ? (
        <Typography as={`h${headingLevel}`} variant="title-sm">
          {trigger}
        </Typography>
      ) : (
        trigger
      )}
      <div id={id} hidden={!expanded} className="min-w-0 w-full">
        {expanded ? children : null}
      </div>
    </div>
  );
}

export function TaskCopyValue({
  value,
  label,
  taskId,
  stateKey,
}: {
  readonly value: string;
  readonly label?: string;
  readonly taskId?: string;
  readonly stateKey?: string;
}) {
  const { t } = useTranslation();
  const [localStatus, setLocalStatus] = useState<'copied' | 'failed' | null>(null);
  const { state, update } = useTaskViewState(taskId ?? '');
  const status = taskId && stateKey ? state.inspectionCopyStatus?.[stateKey] : localStatus;
  const setStatus = (next: 'copied' | 'failed') => {
    if (taskId && stateKey)
      update((previous) => ({
        inspectionCopyStatus: { ...previous.inspectionCopyStatus, [stateKey]: next },
      }));
    else setLocalStatus(next);
  };
  const copyValue = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(value);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  };
  return (
    <div className="pointer-events-auto grid min-w-0 gap-1 justify-items-start">
      <Typography
        as="pre"
        variant="body-sm"
        className="w-full min-w-0 select-text whitespace-pre-wrap font-mono [overflow-wrap:anywhere]"
      >
        {value}
      </Typography>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          void copyValue();
        }}
      >
        {label ?? t('taskDetails.copyValue')}
      </Button>
      {status ? (
        <Typography as="p" variant="body-sm" role="status">
          {t(`taskDetails.copy.${status}`)}
        </Typography>
      ) : null}
    </div>
  );
}
