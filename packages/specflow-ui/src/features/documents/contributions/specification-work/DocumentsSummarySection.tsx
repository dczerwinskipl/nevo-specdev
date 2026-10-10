import { useTranslation } from 'react-i18next';
import type { DocumentItem } from '../../../specs/workspace/model';
import { WorkspaceSection } from '../../../specs/workspace/sections/WorkspaceSection';

export interface DocumentsSummarySectionProps {
  readonly documents: readonly DocumentItem[];
  readonly onOpenDocument: (id: string) => void;
  readonly onOpenDocumentsView: () => void;
}

export function DocumentsSummarySection({
  documents,
  onOpenDocument,
  onOpenDocumentsView,
}: DocumentsSummarySectionProps) {
  const { t } = useTranslation();

  return (
    <WorkspaceSection aria-labelledby="documents-summary-heading">
      <WorkspaceSection.Header
        id="documents-summary-heading"
        title={t('specification.documentsHeading')}
        icon="file"
        count={documents.length}
      />

      <div className="flex flex-wrap items-center gap-4 text-body-xs">
        {documents.slice(1, 3).map((doc) => (
          <button
            key={doc.id}
            type="button"
            onClick={() => onOpenDocument(doc.id)}
            className="font-medium text-accent-primary hover:underline focus-visible:outline-2 focus-visible:outline-focus-ring"
          >
            {doc.title}
          </button>
        ))}
      </div>

      <WorkspaceSection.Footer>
        <WorkspaceSection.Continuation onClick={onOpenDocumentsView}>
          {t('specification.allDocumentsLink')}
        </WorkspaceSection.Continuation>
      </WorkspaceSection.Footer>
    </WorkspaceSection>
  );
}
