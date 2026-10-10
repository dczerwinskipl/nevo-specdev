import { useState } from 'react';
import { Button, InformationList, TextInput, Typography } from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import { OperationalRow } from '../../specs/shared/OperationalList';
import type { DocumentItem } from '../../specs/workspace/model';

export interface DocumentsViewProps {
  readonly documents: readonly DocumentItem[];
  readonly onOpenDocument: (id: string) => void;
}

/** Documents List is a routable Primary; selection goes to a Full Document route. */
export function DocumentsView({ documents, onOpenDocument }: DocumentsViewProps) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = documents.filter((d) =>
    d.title.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="grid max-w-content-standard gap-6 py-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Typography as="h2" variant="title-md" className="font-semibold text-content-primary">
          {t('specification.documentsHeading')}
        </Typography>
        <TextInput
          placeholder={t('specification.searchDocumentPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label={t('specification.searchDocumentPlaceholder')}
          className="w-full sm:w-64"
        />
      </div>

      <Typography variant="body-sm" className="text-content-muted">
        {documents.length > 0
          ? t('specification.documentsConfiguredNotice')
          : t('specification.noDocumentsNotice')}
      </Typography>

      <InformationList>
        {filtered.map((doc) => (
          <OperationalRow
            key={doc.id}
            titleAs="h3"
            primary={doc.title}
            onPrimaryClick={() => onOpenDocument(doc.id)}
            compactFacts={[`${doc.kind} · Markdown`]}
            trailing={
              <Button variant="secondary" size="sm" onClick={() => onOpenDocument(doc.id)}>
                {t('specification.readDocumentAction')}
              </Button>
            }
          />
        ))}
      </InformationList>
    </div>
  );
}
