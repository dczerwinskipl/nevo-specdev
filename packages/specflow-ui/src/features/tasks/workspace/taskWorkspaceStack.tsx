import { useLayoutEffect } from 'react';
import { Image } from 'lucide-react';
import {
  AppContent,
  AppWorkspaceBody,
  MarkdownDocument,
  Typography,
  WorkspaceHeaderIdentity,
  defineSecondaryStack,
  useSecondaryStack,
  type SecondaryScreenProps,
} from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import { useTaskWorkspace } from './TaskWorkspaceState';
import { TaskWorkspaceHistory } from './TaskWorkspaceHistory';
import type { TaskWorkspaceData } from './taskWorkspaceModel';

interface Pages {
  history: Record<never, never>;
  material: { id: string };
}
type ResolvedData = TaskWorkspaceData & { initialMaterialId?: string };
type ScreenProps = SecondaryScreenProps<ResolvedData, Pages['material']>;
export function findWorkspaceMaterial(data: TaskWorkspaceData, id: string) {
  return data.handoffs.flatMap((event) => event.materials).find((item) => item.id === id);
}
function MaterialHeader({ data, params }: ScreenProps) {
  const { t } = useTranslation();
  const material = findWorkspaceMaterial(data, params.id ?? data.initialMaterialId ?? '');
  return (
    <WorkspaceHeaderIdentity
      headingLevel={2}
      title={
        material?.content.state === 'forbidden'
          ? t('taskDetails.restrictedMaterial')
          : (material?.name ?? t('taskDetails.materialUnavailable'))
      }
      icon={
        material?.content.state === 'available' && material.content.kind === 'image'
          ? Image
          : 'file'
      }
    />
  );
}
function MaterialScreen({ data, params }: ScreenProps) {
  const { t } = useTranslation();
  const { setReading } = useTaskWorkspace();
  useLayoutEffect(() => {
    setReading(true);
    return () => setReading(false);
  }, [setReading]);
  const material = findWorkspaceMaterial(data, params.id ?? data.initialMaterialId ?? '');
  const content = material?.content;
  return (
    <AppContent className="w-full max-w-full">
      <AppWorkspaceBody scroll="area">
        <div className="grid min-w-0 gap-4 p-4" data-task-workspace="reader">
          {material && content?.state !== 'forbidden' ? (
            <Typography as="p" variant="body-sm" className="text-content-muted">
              {material.source}
            </Typography>
          ) : null}
          {content?.state === 'available' && content.kind === 'markdown' ? (
            <MarkdownDocument source={content.markdown} />
          ) : content?.state === 'available' && content.kind === 'image' ? (
            <figure>
              <img
                src={content.src}
                alt={content.alt}
                className="max-w-full h-auto object-contain"
              />
            </figure>
          ) : (
            <Typography as="p" variant="body-md">
              {t(
                content?.state === 'forbidden'
                  ? 'taskDetails.materialForbidden'
                  : 'taskDetails.materialUnavailable',
              )}
            </Typography>
          )}
        </div>
      </AppWorkspaceBody>
    </AppContent>
  );
}
function HistoryScreen() {
  const navigation = useSecondaryStack<Pages>();
  return (
    <AppContent className="w-full max-w-full">
      <AppWorkspaceBody padding="none" scroll="area">
        <TaskWorkspaceHistory
          onMaterial={(id) => {
            void navigation.navTo('material', { id });
          }}
        />
      </AppWorkspaceBody>
    </AppContent>
  );
}
function HistoryHeader() {
  const { t } = useTranslation();
  return (
    <WorkspaceHeaderIdentity title={t('taskWorkspace.history')} icon="clock" headingLevel={2} />
  );
}
const screens = {
  history: { title: 'History', header: HistoryHeader, component: HistoryScreen },
  material: { title: 'Material', header: MaterialHeader, component: MaterialScreen },
};
function useData({ taskId, id }: { taskId: string; id?: string }) {
  const { data } = useTaskWorkspace();
  return data.id === taskId
    ? { status: 'ready' as const, data: { ...data, initialMaterialId: id } }
    : { status: 'unavailable' as const };
}
export const taskWorkspaceHistoryStack = defineSecondaryStack<
  { taskId: string },
  ResolvedData,
  Pages
>({ id: 'task-workspace-history', initial: 'history', useData, screens });
export const taskWorkspaceMaterialStack = defineSecondaryStack<
  { taskId: string; id: string },
  ResolvedData,
  Pages
>({
  id: 'task-workspace-material',
  initial: 'material',
  useData,
  screens,
});
