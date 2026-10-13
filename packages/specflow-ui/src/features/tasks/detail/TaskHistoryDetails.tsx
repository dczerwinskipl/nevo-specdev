import { InformationList, Typography } from '@nevo/ui';
import type { TaskHistoryPage } from '@nevo/specflow-contracts/specs/workspace';
import { useTranslation } from 'react-i18next';
import { OperationalRow } from '../../specs/shared/OperationalList';
import { TaskHints } from './TaskHints';
import { TaskCopyValue, TaskDetailDisclosure } from './TaskDetailDisclosure';
import { TaskSourceState } from './TaskDetails';
import type { TaskHistoryResourceParams } from './TaskHistoryResourceInspection';
import { canInspectTaskReference } from './taskReference';

export function TaskHistoryDetails({
  entry,
  token,
  revision,
  taskId,
  onOpenResource,
}: {
  readonly entry: TaskHistoryPage['items'][number];
  readonly token: string;
  readonly revision: string;
  readonly taskId: string;
  readonly onOpenResource?: (params: TaskHistoryResourceParams) => void;
}) {
  const { t } = useTranslation();
  const scope = `history:${revision}:${token}:${entry.id}`;
  const legalResources = entry.resources.filter((resource) => resource.link.state !== 'forbidden');
  return (
    <div className="grid min-w-0 gap-3">
      <TaskHints hints={entry.step.hints} taskId={taskId} scope={`${scope}:hints`} />
      {entry.resources.length ? (
        <section className="grid min-w-0 gap-2">
          <Typography as="h4" variant="title-sm">
            {t('taskDetails.resources')}
          </Typography>
          <InformationList>
            {entry.resources.map((resource, index) => {
              const forbidden = resource.link.state === 'forbidden';
              const readable = canInspectTaskReference(resource.link) && !!onOpenResource;
              return (
                <OperationalRow
                  key={resource.id}
                  primary={forbidden ? t('taskDetails.restrictedMaterial') : resource.title}
                  primaryAriaLabel={
                    forbidden
                      ? undefined
                      : `${resource.title} · ${entry.key.stepId} · ${t('taskDetails.attempt', { count: entry.key.attempt })}`
                  }
                  compactFacts={[resource.kind, resource.relation]}
                  onPrimaryClick={
                    readable
                      ? () =>
                          onOpenResource({
                            entryId: entry.id,
                            resourceId: resource.id,
                            token,
                            revision,
                          })
                      : undefined
                  }
                  supporting={
                    <div className="grid min-w-0 gap-1">
                      <span>
                        {t(
                          readable
                            ? 'taskDetails.materialAvailable'
                            : forbidden
                              ? 'taskDetails.materialForbidden'
                              : 'taskDetails.materialUnavailable',
                        )}
                      </span>
                      {!readable ? (
                        <TaskDetailDisclosure
                          label={t('taskDetails.whyUnavailable')}
                          hideLabel={t('taskDetails.hideExplanation')}
                          taskId={taskId}
                          stateKey={`${scope}:material:${index}:why`}
                        >
                          <TaskSourceState state={forbidden ? 'forbidden' : 'unavailable'} />
                        </TaskDetailDisclosure>
                      ) : null}
                    </div>
                  }
                />
              );
            })}
          </InformationList>
        </section>
      ) : null}
      <TaskDetailDisclosure
        label={t('taskDetails.technicalData')}
        hideLabel={t('taskDetails.hideTechnicalData')}
        taskId={taskId}
        stateKey={`${scope}:technical`}
        headingLevel={4}
      >
        <div className="grid min-w-0 gap-3">
          <section className="grid min-w-0 gap-1">
            <Typography as="h5" variant="label-sm">
              {t('taskDetails.attemptIdentity')}
            </Typography>
            <TaskCopyValue
              taskId={taskId}
              stateKey={`${scope}:identity:copy`}
              value={JSON.stringify(
                {
                  id: entry.id,
                  ...entry.key,
                  startedAt: entry.startedAt,
                  completedAt: entry.completedAt,
                },
                null,
                2,
              )}
            />
          </section>
          {entry.provenance.length ? (
            <section className="grid min-w-0 gap-1">
              <Typography as="h5" variant="label-sm">
                {t('taskDetails.provenance')}
              </Typography>
              <TaskCopyValue
                taskId={taskId}
                stateKey={`${scope}:provenance:copy`}
                value={JSON.stringify(entry.provenance, null, 2)}
              />
            </section>
          ) : null}
          {legalResources.length ? (
            <section className="grid min-w-0 gap-2">
              <Typography as="h5" variant="label-sm">
                {t('taskDetails.materialRelations')}
              </Typography>
              {legalResources.map((resource, index) => (
                <div key={resource.id} className="grid min-w-0 gap-1">
                  <Typography as="p" variant="body-sm">
                    {resource.title}
                  </Typography>
                  <TaskCopyValue
                    taskId={taskId}
                    stateKey={`${scope}:relations:${index}:copy`}
                    value={JSON.stringify(
                      {
                        id: resource.id,
                        title: resource.title,
                        origin: resource.origin,
                        producedFor: resource.producedFor,
                        neededFor: resource.neededFor,
                      },
                      null,
                      2,
                    )}
                  />
                </div>
              ))}
            </section>
          ) : null}
        </div>
      </TaskDetailDisclosure>
      <div className="grid min-w-0 gap-1">
        <Typography as="p" variant="body-sm" className="text-content-muted">
          {t('taskDetails.historyContextUnavailable')}
        </Typography>
        <TaskDetailDisclosure
          label={t('taskDetails.whyUnavailable')}
          hideLabel={t('taskDetails.hideExplanation')}
          taskId={taskId}
          stateKey={`${scope}:context:why`}
        >
          <Typography as="p" variant="body-sm" className="text-content-secondary">
            {t('taskDetails.historyInspectUnavailable')}
          </Typography>
        </TaskDetailDisclosure>
      </div>
    </div>
  );
}
