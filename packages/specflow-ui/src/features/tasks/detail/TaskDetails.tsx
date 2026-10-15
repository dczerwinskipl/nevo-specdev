import { useId, type ReactNode } from 'react';
import { useTaskViewState } from './TaskViewState';
import { AccentBlock, Button, InformationList, MenuItem, OverflowMenu, Typography } from '@nevo/ui';
import type {
  TaskResource,
  TaskHumanRequirement,
  TaskSnapshot,
} from '@nevo/specflow-contracts/specs/workspace';
import { useTranslation } from 'react-i18next';
import { OperationalRow } from '../../specs/shared/OperationalList';
import { WorkspaceSection } from '../../specs/workspace/sections/WorkspaceSection';
import { DocumentDescription } from '../../documents/description/DocumentDescription';
import type { FullTaskData } from '../model';
import { matchesWork } from './taskInspectionModel';
import { taskStatusLabel } from '../status';
import { canInspectTaskReference } from './taskReference';
import { TaskReferenceAvailability } from './TaskReferenceAvailability';

export function mergeTaskResources(
  recommended: readonly TaskResource[],
  pages: readonly (readonly TaskResource[])[],
) {
  return [...new Map([...recommended, ...pages.flat()].map((ref) => [ref.id, ref])).values()];
}
export function pendingRequirements(snapshot: TaskSnapshot): TaskHumanRequirement[] {
  const section = snapshot.sections.humanRequirements;
  return section.state === 'available'
    ? section.data.items
        .filter((item) => item.state === 'pending')
        .sort(
          (a, b) => Number(b.source.kind === 'human-step') - Number(a.source.kind === 'human-step'),
        )
    : [];
}
export interface TaskDetailsProps {
  readonly task: FullTaskData;
  readonly specKey: string;
  readonly preview?: boolean;
  readonly renderDocument?: () => ReactNode;
  readonly resources?: readonly TaskResource[];
  readonly onLoadResources?: () => void;
  readonly resourcesLoading?: boolean;
  readonly resourcesError?: boolean;
  readonly onInspect?: (page: 'work' | 'flow' | 'requirement', id?: string) => void;
  readonly onOpenResource?: (resource: TaskResource) => void;
}
export function TaskSourceState({ state }: { readonly state: 'unavailable' | 'forbidden' }) {
  const { t } = useTranslation();
  return (
    <Typography as="div" variant="body-sm" className="text-content-muted">
      {t(
        state === 'forbidden'
          ? 'specification.resourceAccessDeniedDescription'
          : 'taskDetails.sourceUnavailable',
      )}
    </Typography>
  );
}

export function TaskDetails({
  task,
  specKey,
  preview = false,
  renderDocument,
  resources = [],
  onLoadResources,
  resourcesLoading,
  resourcesError,
  onInspect,
  onOpenResource,
}: TaskDetailsProps) {
  const { t } = useTranslation();
  const id = useId();
  const { state: viewState, update } = useTaskViewState(task.id);
  const requirementsExpanded = viewState.requirementsExpanded ?? false;
  const resourcesExpanded = viewState.resourcesExpanded ?? false;
  const setRequirementsExpanded = (value: boolean) => update({ requirementsExpanded: value });
  const setResourcesExpanded = (value: boolean) => update({ resourcesExpanded: value });
  const snapshot = task.snapshot;
  const work = snapshot?.sections.work;
  const workData = work?.state === 'available' ? work.data : undefined;
  const position = workData?.position;
  const step =
    position?.state === 'active'
      ? position.step
      : position?.state === 'checkpoint' || position?.state === 'not_started'
        ? position.next
        : undefined;
  const requirements = snapshot ? pendingRequirements(snapshot) : [];
  const humanStep = requirements.find((entry) => matchesWork(snapshot, task.id, entry));
  const humanSource = snapshot?.sections.humanRequirements;
  const resourceSource = snapshot?.sections.resources;
  const allResources = mergeTaskResources(
    resourceSource?.state === 'available' ? resourceSource.data.recommended : [],
    [resources],
  );
  const total = resourceSource?.state === 'available' ? resourceSource.data.visibleTotal : 0;
  const limit = preview ? 2 : 3;
  const document = snapshot?.sections.document;
  const currentTitle =
    position?.state === 'terminal'
      ? t('taskDetails.terminal')
      : position?.state === 'checkpoint' || position?.state === 'not_started'
        ? t('taskDetails.nextWork')
        : t('taskDetails.currentWork');
  const status =
    position?.state === 'terminal'
      ? t(`taskDetails.outcome.${position.outcome}`)
      : position?.state === 'active' && position.step.executor === 'human'
        ? t('taskDetails.waitingHuman')
        : position?.state === 'checkpoint'
          ? t('taskDetails.checkpoint')
          : position?.state === 'not_started'
            ? t('taskDetails.notStarted')
            : position?.state === 'active'
              ? t('taskDetails.inProgress')
              : taskStatusLabel(task, t);
  const boundaries = 'border-t border-border-default py-4 @min-[40rem]/task:py-5';

  return (
    <div
      className="@container/task min-w-0 max-w-content-standard"
      data-task-details={preview ? 'preview' : 'full'}
    >
      <div className="pb-4 @min-[40rem]/task:pb-5">
        <Typography
          as={preview ? 'h3' : 'h1'}
          tabIndex={preview ? undefined : -1}
          data-page-title={preview ? undefined : true}
          variant={preview ? 'title-sm' : 'title-lg'}
          className="text-content-primary outline-none [overflow-wrap:anywhere]"
        >
          {task.title}
        </Typography>
        <Typography variant="body-sm" className="mt-1 text-content-muted [overflow-wrap:anywhere]">
          {task.id} · {specKey}
          {snapshot?.group ? ` · ${snapshot.group.label}` : ''}
          {snapshot?.taskType ? ` · ${snapshot.taskType.label}` : ''}
        </Typography>
        <DocumentDescription
          key={`${task.id}:${document?.state === 'available' ? document.data?.revision : ''}`}
          intro={snapshot?.summary ?? task.purpose}
          hasMore={
            Boolean(renderDocument) &&
            (document?.state !== 'available' || document.data?.hasMore !== false)
          }
          renderDocument={renderDocument}
          expanded={viewState.descriptionExpanded}
          savedScrollTop={viewState.descriptionScroll}
          onExpandedChange={(descriptionExpanded, descriptionScroll) =>
            update({ descriptionExpanded, descriptionScroll })
          }
        />
        {document && document.state !== 'available' ? (
          <TaskSourceState state={document.state} />
        ) : null}
        <dl className="mt-3 grid gap-2 @min-[40rem]/task:grid-cols-2">
          <div className="flex min-w-0 gap-2 @min-[40rem]/task:block">
            <dt className="shrink-0 text-body-sm text-content-muted">
              {t('specification.taskStateLabel')}
            </dt>
            <dd className="min-w-0 text-body-sm text-content-primary [overflow-wrap:anywhere]">
              {status}
            </dd>
          </div>
          <div className="flex min-w-0 gap-2 @min-[40rem]/task:block">
            <dt className="shrink-0 text-body-sm text-content-muted">Flow</dt>
            <dd className="min-w-0 text-body-sm text-content-primary [overflow-wrap:anywhere]">
              {workData ? (
                workData.definition.title || workData.definition.id
              ) : (
                <TaskSourceState
                  state={work?.state === 'forbidden' ? 'forbidden' : 'unavailable'}
                />
              )}
            </dd>
          </div>
        </dl>
      </div>
      <WorkspaceSection
        className={requirements.length ? 'pb-4 pt-1 @min-[40rem]/task:pb-5' : boundaries}
        aria-labelledby={`${id}-work`}
      >
        <WorkspaceSection.Header
          headingTag={preview ? 'h4' : 'h2'}
          id={`${id}-work`}
          title={currentTitle}
          actions={
            workData && onInspect ? (
              <OverflowMenu label={currentTitle} triggerLabel={t('taskDetails.workActions')}>
                <MenuItem onSelect={() => onInspect('flow')}>
                  {t('taskDetails.flowDetails')}
                </MenuItem>
              </OverflowMenu>
            ) : undefined
          }
        />
        {!workData ? (
          <TaskSourceState state={work?.state === 'forbidden' ? 'forbidden' : 'unavailable'} />
        ) : (
          <>
            {!humanStep ? (
              <div className="grid gap-1">
                <Typography
                  variant="title-sm"
                  className="text-content-primary [overflow-wrap:anywhere]"
                >
                  {position?.state === 'terminal'
                    ? t(`taskDetails.outcome.${position.outcome}`)
                    : (step?.expectedWork?.summary ?? step?.id)}
                </Typography>
                {step ? (
                  <Typography
                    variant="body-sm"
                    className="text-content-muted [overflow-wrap:anywhere]"
                  >
                    {step.id} · {t(`taskDetails.executor.${step.executor}`)}
                    {position?.state === 'active'
                      ? ` · ${t('taskDetails.attempt', { count: position.key.attempt })}`
                      : ` · ${t('taskDetails.notStarted')}`}
                  </Typography>
                ) : null}
                {step?.purpose ? (
                  <Typography
                    variant="body-sm"
                    className="text-content-secondary [overflow-wrap:anywhere]"
                  >
                    {step.purpose}
                  </Typography>
                ) : null}
                {step && onInspect ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-self-start"
                    onClick={() => onInspect('work')}
                  >
                    {t(
                      position?.state === 'active'
                        ? 'taskDetails.stepDetails'
                        : 'taskDetails.nextStepDetails',
                    )}
                  </Button>
                ) : null}
                {!step && position?.state !== 'terminal' ? (
                  <TaskSourceState state="unavailable" />
                ) : null}
              </div>
            ) : null}
          </>
        )}
        {requirements.length ? (
          <AccentBlock>
            <WorkspaceSection.Header
              headingTag={preview ? 'h4' : 'h2'}
              title={t('specification.requiresAttention')}
              count={requirements.length}
            />
            {humanStep && step ? (
              <Typography variant="body-sm" className="mt-2.5 text-content-muted">
                {step.id} · {t(`taskDetails.executor.${step.executor}`)}
                {position?.state === 'active'
                  ? ` · ${t('taskDetails.attempt', { count: position.key.attempt })}`
                  : ''}
              </Typography>
            ) : null}
            <InformationList id={`${id}-requirements`} className="mt-2.5">
              {(requirementsExpanded ? requirements : requirements.slice(0, 3)).map((entry) => (
                <OperationalRow
                  key={entry.id}
                  primary={entry.title}
                  supporting={
                    entry.instruction || entry.id === humanStep?.id ? (
                      <div className="grid min-w-0 gap-1">
                        {entry.instruction ? <span>{entry.instruction}</span> : null}
                        {entry.id === humanStep?.id && onInspect ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="relative z-10 justify-self-start pointer-events-auto"
                            onClick={() => onInspect('requirement', entry.id)}
                          >
                            {t('taskDetails.details')}
                          </Button>
                        ) : null}
                      </div>
                    ) : undefined
                  }
                  onPrimaryClick={onInspect ? () => onInspect('requirement', entry.id) : undefined}
                />
              ))}
            </InformationList>
            {requirements.length > 3 ? (
              <Button
                variant="secondary"
                size="sm"
                className="mt-2.5"
                aria-expanded={requirementsExpanded}
                aria-controls={`${id}-requirements`}
                onClick={() => setRequirementsExpanded(!requirementsExpanded)}
              >
                {requirementsExpanded
                  ? t('taskDetails.showLess')
                  : t('taskDetails.showAll', { count: requirements.length })}
              </Button>
            ) : null}
          </AccentBlock>
        ) : null}
        {workData?.previousFeedback ? (
          <Typography variant="body-sm" className="text-content-secondary">
            {t('taskDetails.previousFeedback', {
              step: workData?.previousFeedback.key.stepId,
              count: workData?.previousFeedback.key.attempt,
            })}
            : {workData?.previousFeedback.text}
          </Typography>
        ) : null}
        {workData?.blockers.map((blocker) => (
          <Typography
            key={`${blocker.operation}:${blocker.code}`}
            variant="body-sm"
            className="text-status-attention [overflow-wrap:anywhere]"
          >
            {blocker.message}
          </Typography>
        ))}
        {humanSource && humanSource.state !== 'available' ? (
          <TaskSourceState state={humanSource.state} />
        ) : null}
      </WorkspaceSection>
      {resourceSource?.state !== 'available' || total > 0 ? (
        <WorkspaceSection className={boundaries} aria-labelledby={`${id}-resources`}>
          <WorkspaceSection.Header
            headingTag={preview ? 'h4' : 'h2'}
            id={`${id}-resources`}
            title={t('taskDetails.resources')}
            count={resourceSource?.state === 'available' ? total : undefined}
          />
          {resourceSource?.state === 'available' ? (
            <>
              <InformationList id={`${id}-resources-list`}>
                {(resourcesExpanded ? allResources : allResources.slice(0, limit)).map((ref) => (
                  <OperationalRow
                    key={ref.id}
                    primary={ref.title}
                    compactFacts={[
                      ref.kind,
                      ref.producedFor.length
                        ? ref.producedFor.map((key) => `${key.stepId} / ${key.attempt}`).join(', ')
                        : '',
                    ]}
                    supporting={
                      <div className="grid min-w-0 gap-1">
                        <span>{t(`taskDetails.relation.${ref.relation}`)}</span>
                        <TaskReferenceAvailability link={ref.link} />
                      </div>
                    }
                    onPrimaryClick={
                      onOpenResource && canInspectTaskReference(ref.link)
                        ? () => onOpenResource(ref)
                        : undefined
                    }
                  />
                ))}
              </InformationList>
              {total > limit ? (
                <WorkspaceSection.Footer>
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-expanded={resourcesExpanded}
                    aria-controls={`${id}-resources-list`}
                    disabled={resourcesLoading}
                    onClick={() => {
                      if (!resourcesExpanded) {
                        setResourcesExpanded(true);
                        if (allResources.length < total) onLoadResources?.();
                      } else if (allResources.length < total && onLoadResources) onLoadResources();
                      else setResourcesExpanded(false);
                    }}
                  >
                    {resourcesLoading
                      ? t('common.loading')
                      : resourcesError
                        ? t('common.retry')
                        : resourcesExpanded && (allResources.length >= total || !onLoadResources)
                          ? t('taskDetails.showLess')
                          : t('taskDetails.showAll', { count: total })}
                  </Button>
                  {resourcesExpanded && allResources.length < total && !onLoadResources ? (
                    <TaskSourceState state="unavailable" />
                  ) : null}
                  {resourcesError ? (
                    <p role="status" className="mt-1 text-body-sm text-content-muted">
                      {t('taskDetails.pageFailed')}
                    </p>
                  ) : null}
                </WorkspaceSection.Footer>
              ) : null}
            </>
          ) : (
            <TaskSourceState
              state={resourceSource?.state === 'forbidden' ? 'forbidden' : 'unavailable'}
            />
          )}
        </WorkspaceSection>
      ) : null}
      {snapshot?.sections.recovery.state === 'available' && snapshot.sections.recovery.data ? (
        <WorkspaceSection className={boundaries}>
          <WorkspaceSection.Header
            headingTag={preview ? 'h4' : 'h2'}
            title={t('taskDetails.recovery')}
          />
          <Typography variant="body-sm">{snapshot.sections.recovery.data.summary}</Typography>
        </WorkspaceSection>
      ) : null}
      {snapshot?.sections.dependencies.state === 'available' &&
      snapshot.sections.dependencies.data.items.length ? (
        <WorkspaceSection className={boundaries}>
          <WorkspaceSection.Header
            headingTag={preview ? 'h4' : 'h2'}
            title={t('taskDetails.dependencies')}
          />
          <InformationList>
            {snapshot.sections.dependencies.data.items.map((dependency) => (
              <OperationalRow
                key={dependency.taskId}
                primary={dependency.title}
                compactFacts={[dependency.taskId]}
              />
            ))}
          </InformationList>
        </WorkspaceSection>
      ) : null}
    </div>
  );
}
