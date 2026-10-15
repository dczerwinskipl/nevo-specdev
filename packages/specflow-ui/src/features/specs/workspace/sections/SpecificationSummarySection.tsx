import { Typography } from '@nevo/ui';
import { DocumentDescription } from '../../../documents/description/DocumentDescription';
import { markdownIntro } from '../../../documents/description/markdownIntro';
import { DocumentContent } from '../../../documents/connected/DocumentContent';

export interface SpecificationSummarySectionProps {
  readonly title: string;
  readonly intro?: string;
  readonly isEmpty?: boolean;
  readonly mainDocumentId?: string;
  readonly specId?: string;
}
export function SpecificationSummarySection({
  title,
  intro,
  isEmpty = false,
  mainDocumentId,
  specId,
}: SpecificationSummarySectionProps) {
  return (
    <div>
      <Typography
        as="h1"
        tabIndex={-1}
        data-page-title
        variant="title-lg"
        className="font-semibold text-content-primary outline-none [overflow-wrap:anywhere]"
      >
        {title}
      </Typography>
      {!isEmpty ? (
        <DocumentDescription
          key={`${specId}:${mainDocumentId}`}
          intro={
            intro && intro.trim() !== title.trim() ? markdownIntro(intro, title).intro : undefined
          }
          hasMore={Boolean(mainDocumentId && specId)}
          renderDocument={
            mainDocumentId && specId
              ? () => (
                  <DocumentContent specId={specId} documentId={mainDocumentId} omitTitle={title} />
                )
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
