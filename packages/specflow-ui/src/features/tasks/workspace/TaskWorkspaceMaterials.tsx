import { Icon, InformationList } from '@nevo/ui';
import { Download, FileArchive, Image } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  OperationalRow,
  operationalPrimaryLinkClassName,
} from '../../specs/shared/OperationalList';
import type { WorkspaceMaterial } from './taskWorkspaceModel';
import { TaskCopyValue, TaskDetailDisclosure } from '../detail/TaskDetailDisclosure';

export function TaskWorkspaceMaterials({
  materials,
  onOpen,
}: {
  readonly materials: readonly WorkspaceMaterial[];
  readonly onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  if (!materials.length) return null;
  return (
    <InformationList aria-label={t('taskWorkspace.materials')}>
      {materials.map((material) => {
        const content = material.content;
        const forbidden = content.state === 'forbidden';
        const available = content.state === 'available';
        return (
          <OperationalRow
            key={material.id}
            primary={forbidden ? t('taskDetails.restrictedMaterial') : material.name}
            leading={
              <Icon
                name={
                  available && content.kind === 'image'
                    ? Image
                    : available && content.kind === 'archive'
                      ? FileArchive
                      : 'file'
                }
                size="sm"
              />
            }
            onPrimaryClick={
              available && content.kind !== 'archive' ? () => onOpen(material.id) : undefined
            }
            primaryAriaLabel={forbidden ? undefined : `${material.name} · ${material.source}`}
            primaryLink={
              available && content.kind === 'archive' ? (
                <a
                  href={content.href}
                  download={material.name}
                  className={operationalPrimaryLinkClassName}
                >
                  {material.name}
                </a>
              ) : undefined
            }
            supporting={
              <div className="relative z-10 pointer-events-auto grid gap-1 min-w-0">
                <span>
                  {available
                    ? t(
                        content.kind === 'archive'
                          ? 'taskWorkspace.download'
                          : 'taskWorkspace.openMaterial',
                      )
                    : t(
                        forbidden
                          ? 'taskDetails.materialForbidden'
                          : 'taskDetails.materialUnavailable',
                      )}
                </span>
                {material.reference && !forbidden ? (
                  <TaskDetailDisclosure
                    label={t('taskDetails.fullReference')}
                    hideLabel={t('taskDetails.hideReference')}
                  >
                    <TaskCopyValue
                      value={material.reference}
                      label={t('taskDetails.copyReference')}
                    />
                  </TaskDetailDisclosure>
                ) : null}
              </div>
            }
            trailing={
              available && content.kind === 'archive' ? (
                <Icon name={Download} size="sm" />
              ) : undefined
            }
            dataAttributes={{ 'data-material': material.id }}
          />
        );
      })}
    </InformationList>
  );
}
