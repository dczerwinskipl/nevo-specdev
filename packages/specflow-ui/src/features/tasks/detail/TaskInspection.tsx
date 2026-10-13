import { InformationList, Typography, WorkspaceHeaderIdentity } from '@nevo/ui';
import type { TaskResource, TaskLink } from '@nevo/specflow-contracts/specs/workspace';
import { useTranslation } from 'react-i18next';
import { TaskStepInspection } from './TaskStepInspection';
import { matchesWork, inspectionStep, type TaskInspectionAnchor } from './taskInspectionModel';
import { DocumentContent } from '../../documents/connected/DocumentContent';
import { OperationalRow } from '../../specs/shared/OperationalList';
import type { FullTaskData } from '../model';
import { TaskSourceState } from './TaskDetails';

export function TaskInspection({
  task,
  page,
  requirementId,
  onOpenEvidence,
  anchor,
}: {
  readonly task: FullTaskData;
  readonly page: 'work' | 'flow' | 'requirement';
  readonly requirementId?: string;
  readonly anchor?: TaskInspectionAnchor;
  readonly onOpenEvidence?: (params: TaskEvidenceParams) => void;
}) {
  const { t } = useTranslation();
  if (page !== 'flow')
    return (
      <TaskStepInspection
        task={task}
        page={page}
        requirementId={requirementId}
        anchor={anchor}
        onOpenEvidence={onOpenEvidence}
      />
    );
  const snapshot = task.snapshot;
  const work = snapshot?.sections.work;
  if (work?.state !== 'available')
    return <TaskSourceState state={work?.state === 'forbidden' ? 'forbidden' : 'unavailable'} />;
  const data = work.data;
  const position = data.position;
  return (
    <div className="grid min-w-0 gap-3 p-4 [overflow-wrap:anywhere]">
      <Typography as="h3" variant="title-sm">
        {data.definition.title || data.definition.id}
      </Typography>
      <Typography variant="body-sm">{data.definition.description}</Typography>
      <Typography variant="body-sm" className="text-content-muted">
        {data.definition.id} · {data.definition.revision} ·{' '}
        {position.state === 'active' ? position.semanticStatus : position.state}
      </Typography>
      <div className="grid min-w-0 gap-4">
        {data.definition.steps.map(({ step: definedStep, transitions }) => (
          <section key={definedStep.id} className="grid min-w-0 gap-2">
            <Typography as="h4" variant="title-sm">
              {definedStep.expectedWork?.summary ?? definedStep.id}
            </Typography>
            <Typography variant="body-sm" className="text-content-muted">
              {definedStep.id} · {t(`taskDetails.executor.${definedStep.executor}`)}
              {position.state === 'active' && position.step.id === definedStep.id
                ? ` · ${t('taskDetails.currentPosition')} · ${t('taskDetails.attempt', { count: position.key.attempt })}`
                : (position.state === 'checkpoint' || position.state === 'not_started') &&
                    position.next?.id === definedStep.id
                  ? ` · ${t('taskDetails.nextPosition')}`
                  : ''}
              {(position.state === 'checkpoint' || position.state === 'terminal') &&
              position.completed.stepId === definedStep.id
                ? ` · ${t('taskDetails.completedPosition')} · ${t('taskDetails.attempt', { count: position.completed.attempt })}`
                : ''}
            </Typography>
            <Typography variant="body-sm">{definedStep.purpose}</Typography>
            <InformationList>
              {transitions.map((transition) => (
                <OperationalRow
                  key={transition.id}
                  primary={transition.label ?? transition.result ?? transition.id}
                  supporting={[
                    t('taskDetails.transitionTo', {
                      target:
                        transition.target.kind === 'step'
                          ? transition.target.step.id
                          : `${transition.target.status} · ${t(`taskDetails.outcome.${transition.target.outcome}`)}`,
                    }),
                    transition.feedbackRequired ? t('taskDetails.feedbackRequired') : undefined,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                />
              ))}
            </InformationList>
          </section>
        ))}
      </div>
    </div>
  );
}

export interface TaskEvidenceParams {
  readonly requirementId: string;
  readonly index: number;
  readonly revision: string;
}
export function TaskEvidenceInspection({
  task,
  params,
}: {
  readonly task: FullTaskData;
  readonly params: TaskEvidenceParams;
}) {
  const section = task.snapshot?.sections.humanRequirements;
  if (section?.state !== 'available')
    return <TaskSourceState state={section?.state === 'forbidden' ? 'forbidden' : 'unavailable'} />;
  // A refreshed snapshot must never silently retarget an already open evidence reference.
  const evidence =
    task.snapshot?.revision === params.revision
      ? section.data.items.find((item) => item.id === params.requirementId)?.evidence[params.index]
      : undefined;
  return <TaskReferenceInspection link={evidence?.link} />;
}
export function TaskResourceInspection({ resource }: { readonly resource?: TaskResource }) {
  return <TaskReferenceInspection link={resource?.link} />;
}
export function TaskReferenceInspection({ link }: { readonly link?: TaskLink }) {
  if (!link) return <TaskSourceState state="unavailable" />;
  if (link.state !== 'available') return <TaskSourceState state={link.state} />;
  const target = link.target;
  if (target.kind === 'document')
    return (
      <DocumentContent
        specId={target.specId}
        documentId={target.documentId}
        expectedRevision={target.revision}
      />
    );
  // Other resource owners have no inspection reader in this increment.
  return <TaskSourceState state="unavailable" />;
}

export function TaskContextHeader({
  task,
  requirementId,
}: {
  readonly task: FullTaskData;
  readonly requirementId?: string;
}) {
  const { t } = useTranslation();
  const section = task.snapshot?.sections.humanRequirements;
  const requirement =
    section?.state === 'available'
      ? section.data.items.find((item) => item.id === requirementId)
      : undefined;
  const work = task.snapshot?.sections.work;
  const title =
    requirementId && (!requirement || !matchesWork(task.snapshot, task.id, requirement))
      ? 'taskDetails.requirement'
      : inspectionStep(task.snapshot) &&
          work?.state === 'available' &&
          work.data.position.state !== 'active'
        ? 'taskDetails.nextStepDetails'
        : 'taskDetails.stepDetails';
  return <WorkspaceHeaderIdentity headingLevel={2} title={t(title)} />;
}
export function TaskFlowHeader() {
  const { t } = useTranslation();
  return <WorkspaceHeaderIdentity headingLevel={2} title={t('taskDetails.flowDetails')} />;
}
export function TaskRequirementHeader() {
  const { t } = useTranslation();
  return <WorkspaceHeaderIdentity headingLevel={2} title={t('taskDetails.requirement')} />;
}
export function TaskResourceHeader() {
  const { t } = useTranslation();
  return <WorkspaceHeaderIdentity headingLevel={2} title={t('taskDetails.resource')} />;
}
export function TaskHistoryHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeaderIdentity headingLevel={2} title={t('specification.taskFullHistoryHeading')} />
  );
}

export function TaskEvidenceHeader() {
  const { t } = useTranslation();
  return <WorkspaceHeaderIdentity headingLevel={2} title={t('taskDetails.evidence')} />;
}
