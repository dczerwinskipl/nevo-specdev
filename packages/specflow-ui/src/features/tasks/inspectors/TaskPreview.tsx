import { IconButton } from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import type { TaskGroup, TaskItem } from '../model';
import { TaskContent } from '../detail/TaskContent';
import type { TaskDetailsProps } from '../detail/TaskDetails';
import { useLayoutEffect, useRef } from 'react';
import { useTaskViewState } from '../detail/TaskViewState';
import { descriptionScrollOwner } from '../../documents/description/DocumentDescription';

export interface TaskPreviewProps {
  readonly task: TaskItem;
  readonly groups: readonly TaskGroup[];
  readonly specKey: string;
  readonly onClose?: () => void;
  readonly onOpenFull: (taskId: string) => void;
  readonly onInspect?: TaskDetailsProps['onInspect'];
  readonly onOpenResource?: TaskDetailsProps['onOpenResource'];
}
export function TaskPreview({
  task,
  specKey,
  onClose,
  onInspect,
  onOpenResource,
}: TaskPreviewProps) {
  const { t } = useTranslation();
  const root = useRef<HTMLElement>(null);
  const { state, saveScroll } = useTaskViewState(task.id);
  const initialScroll = useRef(state.scrollTop ?? 0);
  const preparedNavigation = useRef(false);
  useLayoutEffect(() => {
    if (!root.current) return;
    const owner = descriptionScrollOwner(root.current);
    owner.scrollTop = initialScroll.current;
    // The workspace resets its mobile viewport and restores the opener in the next frame.
    // Restore Task scroll after that shared navigation lifecycle has settled.
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        owner.scrollTop = initialScroll.current;
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      if (!preparedNavigation.current) saveScroll(owner.scrollTop);
    };
  }, [saveScroll]);
  const rememberScroll = () => {
    if (!root.current) return;
    preparedNavigation.current = true;
    saveScroll(descriptionScrollOwner(root.current).scrollTop);
  };
  return (
    <aside ref={root} className="min-w-0 p-4" aria-label={t('specification.taskPreviewAriaLabel')}>
      {onClose ? (
        <IconButton
          icon="close"
          size="sm"
          variant="ghost"
          onClick={onClose}
          aria-label={t('specification.closeTaskPreview')}
        />
      ) : null}
      <TaskContent
        task={task}
        specKey={specKey}
        preview
        onInspect={
          onInspect
            ? (page, id) => {
                rememberScroll();
                onInspect(page, id);
              }
            : undefined
        }
        onOpenResource={
          onOpenResource
            ? (resource) => {
                rememberScroll();
                onOpenResource(resource);
              }
            : undefined
        }
      />
    </aside>
  );
}
