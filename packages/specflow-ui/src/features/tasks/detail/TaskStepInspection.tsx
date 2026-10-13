import { InformationList, Typography } from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import { canInspectTaskReference } from './taskReference';
import { TaskReferenceAvailability } from './TaskReferenceAvailability';
import { useTaskInspectionScroll } from './useTaskInspectionScroll';
import type { FullTaskData } from '../model';
import { OperationalRow } from '../../specs/shared/OperationalList';
import { TaskSourceState } from './TaskDetails';
import { inspectionStep, matchesWork, type TaskInspectionAnchor } from './taskInspectionModel';
import type { TaskEvidenceParams } from './TaskInspection';

import { TaskHints } from './TaskHints';
export { TaskHints } from './TaskHints';

export function TaskStepInspection({
  task,
  page,
  requirementId,
  anchor,
  onOpenEvidence,
}: {
  readonly task: FullTaskData;
  readonly page: 'work' | 'requirement';
  readonly requirementId?: string;
  readonly anchor?: TaskInspectionAnchor;
  readonly onOpenEvidence?: (params: TaskEvidenceParams) => void;
}) {
  const { t } = useTranslation();
  const { root, remember } = useTaskInspectionScroll(
    task.id,
    `${anchor?.revision ?? task.snapshot?.revision}:${page}:${requirementId ?? ''}`,
  );
  const snapshot = task.snapshot;
  const work = snapshot?.sections.work;
  const source = snapshot?.sections.humanRequirements;
  // Authorization takes precedence over stale-context diagnostics.
  const owner = page === 'work' ? work : source;
  if (owner?.state !== 'available')
    return <TaskSourceState state={owner?.state === 'forbidden' ? 'forbidden' : 'unavailable'} />;
  if (anchor && anchor.revision !== snapshot?.revision)
    return (
      <Typography as="p" variant="body-sm" role="status">
        {t('taskDetails.contextChanged')}
      </Typography>
    );
  const requirement =
    page === 'requirement' && source?.state === 'available'
      ? source.data.items.find((item) => item.id === requirementId)
      : undefined;
  if (page === 'requirement' && !requirement)
    return (
      <Typography as="p" variant="body-sm" role="status">
        {t('taskDetails.requirementChanged')}
      </Typography>
    );
  const combined = !!requirement && matchesWork(snapshot, task.id, requirement);
  const data = work?.state === 'available' && (page === 'work' || combined) ? work.data : undefined;
  const step = data ? inspectionStep(snapshot) : undefined;
  const position = data?.position;
  const texts = [
    ...new Set(
      [
        step?.expectedWork?.summary,
        step?.purpose,
        requirement?.title,
        requirement?.instruction,
      ].filter((text): text is string => !!text),
    ),
  ];
  return (
    <div ref={root} className="grid min-w-0 gap-3 p-4 [overflow-wrap:anywhere]">
      {texts.map((text, index) => (
        <Typography
          key={text}
          as={index === 0 ? 'h3' : 'p'}
          variant={index === 0 ? 'title-sm' : 'body-sm'}
        >
          {text}
        </Typography>
      ))}
      {step ? (
        <Typography as="p" variant="body-sm" className="text-content-muted">
          {step.id} · {t(`taskDetails.executor.${step.executor}`)} ·{' '}
          {position?.state === 'active'
            ? `${t('taskDetails.currentPosition')} · ${t('taskDetails.attempt', { count: position.key.attempt })} · ${position.semanticStatus}`
            : t('taskDetails.nextPosition')}
          {data ? ` · ${data.definition.revision}` : ''}
        </Typography>
      ) : null}
      {requirement ? (
        <>
          <Typography as="p" variant="body-sm" className="text-content-muted">
            {requirement.id} · {requirement.state} · {requirement.definitionRevision}
            {requirement.key
              ? ` · ${requirement.key.specId} / ${requirement.key.taskId} / ${requirement.key.stepId} · ${t('taskDetails.attempt', { count: requirement.key.attempt })}`
              : ''}
          </Typography>
          {requirement.source.kind === 'human-step' && !combined ? (
            <Typography as="p" variant="body-sm" role="status">
              {t('taskDetails.contextMismatch')}
            </Typography>
          ) : null}
          {requirement.state !== 'pending' ? (
            <Typography as="p" variant="body-sm" role="status">
              {t('taskDetails.requirementChanged')}
            </Typography>
          ) : null}
          {requirement.source.kind === 'human-gate' ? (
            <Typography as="p" variant="body-sm">
              {requirement.source.phase} · {requirement.source.role} · {requirement.source.scope} ·{' '}
              {requirement.source.targetId}
            </Typography>
          ) : null}
          {requirement.inspectionProblem ? (
            <Typography as="p" variant="body-sm" role="status">
              {requirement.inspectionProblem}
            </Typography>
          ) : null}
        </>
      ) : null}
      {step ? (
        <TaskHints
          hints={step.hints}
          taskId={task.id}
          scope={`${snapshot?.revision}:${page}:${requirementId ?? ''}:hints`}
        />
      ) : null}
      {data?.blockers.map((blocker) => (
        <Typography key={`${blocker.operation}:${blocker.code}`} as="p" variant="body-sm">
          {blocker.operation} · {blocker.code}: {blocker.message}
        </Typography>
      ))}
      {data?.previousFeedback ? (
        <Typography as="p" variant="body-sm">
          {t('taskDetails.previousFeedback', {
            step: data.previousFeedback.key.stepId,
            count: data.previousFeedback.key.attempt,
          })}{' '}
          · {data.previousFeedback.key.specId} / {data.previousFeedback.key.taskId} ·{' '}
          {data.previousFeedback.result}: {data.previousFeedback.text}
        </Typography>
      ) : null}
      {requirement?.evidence.length ? (
        <section className="grid gap-2">
          <Typography as="h4" variant="title-sm">
            {t('taskDetails.evidence')}
          </Typography>
          <InformationList>
            {requirement.evidence.map((evidence, index) => (
              <OperationalRow
                key={index}
                primary={evidence.title}
                onPrimaryClick={
                  canInspectTaskReference(evidence.link) && onOpenEvidence
                    ? () => {
                        remember();
                        onOpenEvidence({
                          requirementId: requirement.id,
                          index,
                          revision: snapshot!.revision,
                        });
                      }
                    : undefined
                }
                supporting={<TaskReferenceAvailability link={evidence.link} />}
              />
            ))}
          </InformationList>
        </section>
      ) : null}
      {data ? (
        <section className="grid gap-2">
          <Typography as="h4" variant="title-sm">
            {t('taskDetails.workTransitions')}
          </Typography>
          <InformationList>
            {(position?.state === 'active'
              ? data.transitions
              : (data.definition.steps.find((item) => item.step.id === step?.id)?.transitions ?? [])
            ).map((action) => (
              <OperationalRow
                key={action.id}
                primary={action.label ?? action.result ?? action.id}
                supporting={[
                  t('taskDetails.transitionTo', {
                    target:
                      action.target.kind === 'step'
                        ? action.target.step.id
                        : `${action.target.status} · ${t(`taskDetails.outcome.${action.target.outcome}`)}`,
                  }),
                  action.feedbackRequired ? t('taskDetails.feedbackRequired') : undefined,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
            ))}
          </InformationList>
        </section>
      ) : null}
      {requirement ? (
        <section className="grid gap-2">
          <Typography as="h4" variant="title-sm">
            {t('taskDetails.requirementActions')}
          </Typography>
          <InformationList>
            {requirement.actions.map((action, index) => (
              <OperationalRow
                key={index}
                primary={action.label}
                supporting={action.feedbackRequired ? t('taskDetails.feedbackRequired') : undefined}
              />
            ))}
          </InformationList>
        </section>
      ) : null}
    </div>
  );
}
