import { useLayoutEffect, useRef, useId } from 'react';
import { TaskHistoryDetails } from './TaskHistoryDetails';
import { useTaskViewState } from './TaskViewState';
import { descriptionScrollOwner } from '../../documents/description/DocumentDescription';
import type { TaskHistoryResourceParams } from './TaskHistoryResourceInspection';
import { Button, Timeline, Typography } from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import type { TaskSnapshot } from '@nevo/specflow-contracts/specs/workspace';
import { TaskSourceState } from './TaskDetails';
import { useTaskHistory } from './useTaskPages';

export function TaskHistory({
  specId,
  taskId,
  snapshot,
  onOpenResource,
}: {
  readonly specId: string;
  readonly taskId: string;
  readonly snapshot?: TaskSnapshot;
  readonly onOpenResource?: (params: TaskHistoryResourceParams) => void;
}) {
  const { t } = useTranslation();
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const { state, update, saveHistoryScroll } = useTaskViewState(taskId);
  const initialScroll = useRef(state.historyScroll ?? 0);
  const prepared = useRef(false);
  useLayoutEffect(() => {
    if (!root.current) return;
    const owner = descriptionScrollOwner(root.current);
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        owner.scrollTop = initialScroll.current;
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      if (!prepared.current) saveHistoryScroll(owner.scrollTop);
    };
  }, [saveHistoryScroll]);
  const rememberScroll = () => {
    if (root.current) {
      prepared.current = true;
      saveHistoryScroll(descriptionScrollOwner(root.current).scrollTop);
    }
  };

  const query = useTaskHistory(specId, taskId, snapshot);
  const section = snapshot?.sections.history;
  if (query.accessDenied) return <TaskSourceState state="forbidden" />;
  if (section?.state !== 'available' || !query.readerAvailable)
    return <TaskSourceState state={section?.state === 'forbidden' ? 'forbidden' : 'unavailable'} />;
  const entries =
    query.data?.pages.flatMap((page) =>
      page.items.map((entry) => ({ entry, token: page.token })),
    ) ?? [];
  return (
    <div ref={root} className="grid min-w-0 gap-3 p-4">
      {query.isPending && !query.isError ? (
        <Typography as="p" variant="body-sm">
          {t('common.loading')}
        </Typography>
      ) : null}
      <Timeline size="md">
        {entries.map(({ entry, token }) => (
          <Timeline.Item key={entry.id}>
            <Timeline.Marker tone="neutral" />
            <Timeline.Content
              title={
                <span role="heading" aria-level={3}>
                  {entry.step.expectedWork?.summary ?? entry.step.id}
                </span>
              }
            >
              <div className="grid min-w-0 gap-1 [overflow-wrap:anywhere]">
                <Typography as="p" variant="body-sm" className="text-content-muted">
                  {entry.step.id} · {t(`taskDetails.executor.${entry.step.executor}`)} ·{' '}
                  {t('taskDetails.attempt', { count: entry.key.attempt })}
                  {entry.result ? ` · ${entry.result}` : ''}
                </Typography>
                {(['startedAt', 'completedAt'] as const).map((field) =>
                  entry[field] ? (
                    <Typography key={field} as="p" variant="body-sm" className="text-content-muted">
                      {t(`taskDetails.${field}`)}:{' '}
                      <time dateTime={entry[field]}>{entry[field]}</time>
                    </Typography>
                  ) : null,
                )}
                {entry.step.purpose ? (
                  <Typography as="p" variant="body-sm">
                    {entry.step.purpose}
                  </Typography>
                ) : null}
                {entry.transitionedTo ? (
                  <Typography as="p" variant="body-sm">
                    {t('taskDetails.transitionTo', {
                      target:
                        entry.transitionedTo.kind === 'step'
                          ? `${entry.transitionedTo.step.expectedWork?.summary ?? entry.transitionedTo.step.id} · ${entry.transitionedTo.step.id}`
                          : `${entry.transitionedTo.status} · ${t(`taskDetails.outcome.${entry.transitionedTo.outcome}`)}`,
                    })}
                  </Typography>
                ) : null}
                {entry.feedback ? (
                  <Typography as="p" variant="body-sm">
                    {entry.feedback}
                  </Typography>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-self-start"
                  aria-expanded={!!state.historyExpanded?.[entry.id]}
                  aria-controls={`${id}-${entry.id}`}
                  onClick={(event) => {
                    const expanded = { ...state.historyExpanded };
                    if (expanded[entry.id]) delete expanded[entry.id];
                    else expanded[entry.id] = `${snapshot?.revision}:${token}`;
                    update({ historyExpanded: expanded });
                    event.currentTarget.focus({ preventScroll: true });
                  }}
                >
                  {t(
                    state.historyExpanded?.[entry.id]
                      ? 'taskDetails.hideAttemptDetails'
                      : 'taskDetails.attemptDetails',
                  )}
                </Button>
                {state.historyExpanded?.[entry.id] ? (
                  <div id={`${id}-${entry.id}`} className="grid min-w-0 gap-3">
                    {state.historyExpanded[entry.id] !== `${snapshot?.revision}:${token}` ? (
                      <Typography as="p" variant="body-sm" role="status">
                        {t('taskDetails.contextChanged')}
                      </Typography>
                    ) : (
                      <TaskHistoryDetails
                        entry={entry}
                        token={token}
                        revision={snapshot!.revision}
                        taskId={taskId}
                        onOpenResource={
                          onOpenResource
                            ? (params) => {
                                rememberScroll();
                                onOpenResource(params);
                              }
                            : undefined
                        }
                      />
                    )}
                  </div>
                ) : null}
              </div>
            </Timeline.Content>
          </Timeline.Item>
        ))}
      </Timeline>
      {query.data?.pages.some((page) => page.coverage === 'partial') ? (
        <Typography as="p" variant="body-sm">
          {t('taskDetails.partialHistory')}
        </Typography>
      ) : null}
      {query.isError ? (
        <>
          <Typography as="p" variant="body-sm" role="status">
            {t('taskDetails.pageFailed')}
          </Typography>
          <Button variant="secondary" size="sm" onClick={() => void query.retryPage()}>
            {t('common.retry')}
          </Button>
        </>
      ) : query.hasNextPage ? (
        <Button
          variant="secondary"
          size="sm"
          disabled={query.isFetching}
          onClick={() => void query.fetchNextPage()}
        >
          {t('taskDetails.showMore')}
        </Button>
      ) : null}
    </div>
  );
}
