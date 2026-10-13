import { Button, MarkdownDocument, Typography } from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import { useTaskWorkspace, useWorkspaceScroll } from './TaskWorkspaceState';
import { TaskWorkspaceMaterials } from './TaskWorkspaceMaterials';

export function TaskWorkspaceHistory({
  onMaterial,
}: {
  readonly onMaterial: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { data, event, setEvent } = useTaskWorkspace();
  const { ref, captureBeforeNavigation } = useWorkspaceScroll('history');
  return (
    <div ref={ref} className="min-w-0 p-4" data-task-workspace="history">
      {!data.handoffs.length ? (
        <Typography as="p" variant="body-md">
          {t(
            data.phase === 'draft'
              ? 'taskWorkspace.draftHistory'
              : data.phase === 'ready'
                ? 'taskWorkspace.readyHistory'
                : 'taskWorkspace.emptyHistory',
          )}
        </Typography>
      ) : (
        <ol className="grid min-w-0 gap-5 border-l border-border-subtle ml-1">
          {data.handoffs.map((item) => (
            <li key={item.id} className="relative grid min-w-0 gap-2 pl-5 [overflow-wrap:anywhere]">
              <span
                aria-hidden="true"
                className="absolute -left-1 top-1.5 size-2 rounded-full bg-content-muted"
              />
              <Typography as="p" variant="body-sm" className="text-content-muted">
                {item.time ? (
                  <>
                    <time>{item.time}</time> ·{' '}
                  </>
                ) : null}
                {item.from} · {t('taskWorkspace.attempt', { count: item.attempt })}
              </Typography>
              <Typography as="h3" variant="title-sm">
                {item.from} → {item.to}
              </Typography>
              {item.result ? (
                <Typography
                  as="p"
                  variant="body-md"
                  className={item.result.tone === 'attention' ? 'text-accent-attention' : undefined}
                >
                  {item.result.label}
                </Typography>
              ) : null}
              {item.feedback ? <MarkdownDocument source={item.feedback} /> : null}
              {item.materials.length ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-self-start h-auto whitespace-normal text-left"
                    aria-expanded={event === item.id}
                    aria-controls={`materials-${item.id}`}
                    onClick={() => setEvent(event === item.id ? null : item.id)}
                  >
                    {t(
                      event === item.id
                        ? 'taskWorkspace.hideMaterials'
                        : 'taskWorkspace.eventMaterials',
                    )}
                  </Button>
                  <div id={`materials-${item.id}`} hidden={event !== item.id}>
                    {event === item.id ? (
                      <TaskWorkspaceMaterials
                        materials={item.materials}
                        onOpen={(id) => {
                          captureBeforeNavigation();
                          onMaterial(id);
                        }}
                      />
                    ) : null}
                  </div>
                </>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
