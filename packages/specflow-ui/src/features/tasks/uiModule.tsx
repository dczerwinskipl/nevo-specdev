import { Alert } from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import { contributeTo, type UiModule } from '../../app/ui-modules/contracts';
import {
  specificationWorkSections,
  type SpecificationWorkSectionContext,
} from '../specs/extensions/specificationWorkSections';
import { TasksSection } from './contributions/specification-work';
import { specificationAttentionItems } from '../specs/extensions/specificationAttentionItems';

function TaskGroupsWorkSection({ specId, data, actions }: SpecificationWorkSectionContext) {
  const { t } = useTranslation();
  if (
    data.sectionAvailability?.tasks === 'forbidden' ||
    data.sectionAvailability?.tasks === 'unavailable'
  ) {
    return (
      <Alert tone="attention" title={t('specification.unavailableTitle')}>
        {t('specification.unavailableDescription', { id: specId })}
      </Alert>
    );
  }

  return (
    <TasksSection
      key={specId}
      taskGroups={data.taskGroups}
      isPreparing={data.isPreparing}
      totalTasksCount={data.totalTasksCount}
      completedTasksCount={data.completedTasksCount}
      executionReadiness={data.executionReadiness}
      onPreviewTask={actions.previewTask}
      fullTaskHref={actions.fullTaskHref}
      onExecuteTasks={actions.executeTasks}
      canExecute={actions.canExecute !== false}
    />
  );
}

export const tasksUiModule: UiModule = {
  id: 'specflow.tasks',
  contributions: [
    contributeTo(specificationWorkSections, {
      id: 'specflow.tasks.task-groups',
      slot: 'main',
      isVisible: ({ data }) =>
        !data.isEmpty ||
        data.sectionAvailability?.tasks === 'forbidden' ||
        data.sectionAvailability?.tasks === 'unavailable',
      Component: TaskGroupsWorkSection,
    }),
    contributeTo(specificationAttentionItems, {
      id: 'specflow.tasks.attention',
      getItems: ({ data, actions }) => {
        const source = data.featureAttention?.tasks;
        if (!source || (source.state === 'unavailable' && source.reason === 'source_unavailable')) {
          return { state: 'unavailable' };
        }
        if (source.state !== 'available') return { state: 'excluded' };
        return source.items.map((item) => ({
          item,
          icon: 'list-checks',
          action: item.targetId
            ? {
                label: item.actionLabel,
                labelKey:
                  item.actionCode === 'task' ? 'specification.attentionViewTask' : undefined,
                onClick: () => actions.previewTask(item.targetId!),
              }
            : undefined,
        }));
      },
    }),
  ],
};
