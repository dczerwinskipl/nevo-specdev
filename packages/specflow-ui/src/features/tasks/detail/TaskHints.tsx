import { InformationList, Typography } from '@nevo/ui';
import type { TaskHistoryPage } from '@nevo/specflow-contracts/specs/workspace';
import { useTranslation } from 'react-i18next';
import { TaskCopyValue, TaskDetailDisclosure } from './TaskDetailDisclosure';
import { presentTaskHints } from './taskHintPresentation';

export function TaskHints({
  hints,
  taskId,
  scope,
}: {
  readonly hints: TaskHistoryPage['items'][number]['step']['hints'];
  readonly taskId?: string;
  readonly scope?: string;
}) {
  const { t } = useTranslation();
  if (!hints.length) return null;
  return (
    <section className="grid min-w-0 gap-2">
      <Typography as="h4" variant="title-sm">
        {t('taskDetails.hints')}
      </Typography>
      <InformationList>
        {presentTaskHints(hints).map(({ hint, name, parent }, index) => (
          <InformationList.Item key={`${hint.kind}:${hint.ref}:${index}`}>
            <InformationList.Content>
              <Typography
                as="p"
                variant="title-sm"
                className="line-clamp-2 min-w-0 [overflow-wrap:anywhere]"
              >
                {name}
              </Typography>
              {parent ? (
                <Typography as="p" variant="body-sm" className="truncate text-content-muted">
                  {parent}
                </Typography>
              ) : null}
              <Typography
                as="p"
                variant="body-sm"
                className="text-content-secondary [overflow-wrap:anywhere]"
              >
                <span className="text-content-muted">{hint.kind}</span> ·{' '}
                {t('taskDetails.hintReferenceOnly')}
              </Typography>
              <TaskDetailDisclosure
                label={t('taskDetails.fullReference')}
                hideLabel={t('taskDetails.hideReference')}
                taskId={taskId}
                stateKey={scope ? `${scope}:ref:${index}` : undefined}
              >
                <TaskCopyValue
                  value={hint.ref}
                  label={t('taskDetails.copyReference')}
                  taskId={taskId}
                  stateKey={scope ? `${scope}:ref:${index}:copy` : undefined}
                />
              </TaskDetailDisclosure>
            </InformationList.Content>
          </InformationList.Item>
        ))}
      </InformationList>
      <TaskDetailDisclosure
        label={t('taskDetails.whyUnavailable')}
        hideLabel={t('taskDetails.hideExplanation')}
        taskId={taskId}
        stateKey={scope ? `${scope}:why` : undefined}
      >
        <Typography as="p" variant="body-sm" className="text-content-secondary">
          {t('taskDetails.hintUnresolved')}
        </Typography>
      </TaskDetailDisclosure>
    </section>
  );
}
