import { useId, useState } from 'react';
import { Button, InformationList, MenuItem, OverflowMenu } from '@nevo/ui';
import { OperationalRow } from '../../../specs/shared/OperationalList';
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
  const id = useId();
  const [expanded, setExpanded] = useState(false);

  return (
    <WorkspaceSection aria-labelledby="documents-summary-heading">
      <WorkspaceSection.Header
        id="documents-summary-heading"
        title={t('specification.documentsHeading')}
        icon="file"
        count={documents.length}
        actions={
          <OverflowMenu
            triggerLabel={t('specification.documentsHeading')}
            label={t('specification.documentsHeading')}
          >
            <MenuItem onSelect={onOpenDocumentsView}>
              {t('specification.allDocumentsLink')}
            </MenuItem>
          </OverflowMenu>
        }
      />

      <InformationList id={id}>
        {(expanded ? documents : documents.slice(0, 3)).map((doc) => (
          <OperationalRow
            key={doc.id}
            primary={doc.title}
            compactFacts={[doc.kind]}
            supporting={doc.summary}
            onPrimaryClick={() => onOpenDocument(doc.id)}
          />
        ))}
      </InformationList>
      {documents.length > 3 ? (
        <WorkspaceSection.Footer>
          <Button
            variant="secondary"
            size="sm"
            aria-expanded={expanded}
            aria-controls={id}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded
              ? t('taskDetails.showLess')
              : t('taskDetails.showAll', { count: documents.length })}
          </Button>
        </WorkspaceSection.Footer>
      ) : null}
    </WorkspaceSection>
  );
}
