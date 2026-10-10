import { Typography } from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import { useWorkspaceRuntime } from '../WorkspaceContext';

export interface SpecificationSummarySectionProps {
  readonly title: string;
  readonly intro?: string;
  readonly isEmpty?: boolean;
  readonly mainDocumentId?: string;
}

export function SpecificationSummarySection({
  title,
  intro,
  isEmpty = false,
  mainDocumentId,
}: SpecificationSummarySectionProps) {
  const { t } = useTranslation();
  const runtime = useWorkspaceRuntime();

  return (
    <div>
      <Typography as="h2" variant="title-lg" className="font-semibold text-content-primary">
        {title}
      </Typography>
      {!isEmpty && intro ? (
        <div className="mt-2 grid gap-2">
          <Typography variant="body-md" className="text-content-secondary">
            {intro}
          </Typography>
          {mainDocumentId ? (
            <button
              type="button"
              onClick={() => runtime.openDoc(mainDocumentId)}
              className="w-fit text-left text-body-sm font-medium text-accent-primary hover:underline focus-visible:outline-2 focus-visible:outline-focus-ring"
            >
              {t('specification.readSpecificationLink')}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
