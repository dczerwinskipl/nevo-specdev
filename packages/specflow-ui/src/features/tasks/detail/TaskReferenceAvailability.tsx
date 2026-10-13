import { Typography } from '@nevo/ui';
import type { TaskLink } from '@nevo/specflow-contracts/specs/workspace';
import { useTranslation } from 'react-i18next';
import { canInspectTaskReference } from './taskReference';

export function TaskReferenceAvailability({ link }: { readonly link: TaskLink }) {
  const { t } = useTranslation();
  if (canInspectTaskReference(link)) return null;
  return (
    <Typography as="span" variant="body-sm" className="text-content-muted">
      {t(
        link.state === 'available'
          ? 'taskDetails.readerUnavailable'
          : link.state === 'forbidden'
            ? 'taskDetails.materialForbidden'
            : 'taskDetails.materialUnavailable',
      )}
    </Typography>
  );
}
