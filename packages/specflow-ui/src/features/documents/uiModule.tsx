import { contributeTo, type UiModule } from '../../app/ui-modules/contracts';
import {
  specificationWorkSections,
  type SpecificationWorkSectionContext,
} from '../specs/extensions/specificationWorkSections';
import { DocumentsSummarySection } from './contributions/specification-work/DocumentsSummarySection';

function SpecificationDocuments({ data, actions }: SpecificationWorkSectionContext) {
  return (
    <DocumentsSummarySection
      documents={data.documents}
      onOpenDocument={actions.openDoc}
      onOpenDocumentsView={actions.openDocumentsView}
    />
  );
}

export const documentsUiModule: UiModule = {
  id: 'specflow.documents',
  contributions: [
    contributeTo(specificationWorkSections, {
      id: 'specflow.documents.summary',
      slot: 'related',
      isVisible: ({ data }) =>
        !data.isEmpty &&
        (!data.sectionAvailability?.documents ||
          data.sectionAvailability.documents === 'available'),
      Component: SpecificationDocuments,
    }),
  ],
};
