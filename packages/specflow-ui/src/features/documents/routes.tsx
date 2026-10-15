import { createRoute } from '@tanstack/react-router';
import { useCachedQueryState } from '../../app/useCachedQueryState';
import { documentKeys } from './queries';
import type { SpecificationDocumentResponse } from '@nevo/specflow-contracts/specs/workspace';
import {
  ApplicationLocationIdentity,
  ApplicationContextLine,
  ViewPageTitle,
} from '../../app/navigation/ApplicationLocation';
import { useTranslation } from 'react-i18next';
import {
  AppContent,
  AppContentContainer,
  AppWorkspace,
  AppWorkspaceBody,
  WorkspaceHeader,
} from '@nevo/ui';
import { specificationRoute } from '../specs/routes';
import { parseSpecificationCollection } from '../../app/router/search';
import { SpecificationAggregatePage } from '../specs/pages/SpecificationAggregatePage';
import { DocumentsView } from './views/DocumentsView';
import { DocumentContent } from './connected/DocumentContent';

export const documentsRoute = createRoute({
  getParentRoute: () => specificationRoute,
  path: 'documents',
  validateSearch: (search: Record<string, unknown>) => ({
    collection: parseSpecificationCollection(search),
  }),
  component: DocumentsRouteScreen,
});

export const documentDetailRoute = createRoute({
  getParentRoute: () => specificationRoute,
  path: 'documents/$documentId',
  validateSearch: (search: Record<string, unknown>) => ({
    collection: parseSpecificationCollection(search),
  }),
  component: DocumentDetailRouteScreen,
});

function DocumentsRouteScreen() {
  const { specId } = documentsRoute.useParams();
  const { collection } = documentsRoute.useSearch();
  const navigate = documentsRoute.useNavigate();
  const { t } = useTranslation();
  return (
    <SpecificationAggregatePage
      specId={specId}
      title={t('specification.documentsHeading')}
      section="documents"
    >
      {(data) => (
        <DocumentsView
          showHeading={false}
          documents={data.documents}
          onOpenDocument={(documentId) => {
            void navigate({
              to: '/specs/$specId/documents/$documentId',
              params: { specId, documentId },
              search: { collection },
              state: { specflowDocumentReturnTo: 'documents' },
            });
          }}
        />
      )}
    </SpecificationAggregatePage>
  );
}

function DocumentDetailRouteScreen() {
  const { specId, documentId } = documentDetailRoute.useParams();
  const { t } = useTranslation();
  const document = useCachedQueryState<SpecificationDocumentResponse>(
    documentKeys.detail(specId, documentId),
  );
  const title =
    document?.status === 'error'
      ? t('specification.viewDocuments')
      : (document?.data?.title ?? t('specification.viewDocuments'));
  return (
    <AppWorkspace split="primary">
      <AppWorkspace.Primary
        header={
          <WorkspaceHeader
            title={t('specification.viewDocuments')}
            as="span"
            identityContent={
              <ApplicationLocationIdentity
                title={t('specification.viewDocuments')}
                view="document"
                specId={specId}
                detailLabel={title}
              />
            }
          />
        }
      >
        <AppContent className="w-content-xwide max-w-full">
          <AppWorkspaceBody className="py-6">
            <AppContentContainer align="start" size="full">
              <div className="grid max-w-content-standard gap-6">
                <div>
                  <ApplicationContextLine specId={specId} view="document" />
                  <ViewPageTitle className="mb-0">{title}</ViewPageTitle>
                </div>
                <DocumentContent
                  specId={specId}
                  documentId={documentId}
                  omitTitle={document?.data?.title}
                  headingOffset={1}
                />
              </div>
            </AppContentContainer>
          </AppWorkspaceBody>
        </AppContent>
      </AppWorkspace.Primary>
    </AppWorkspace>
  );
}

export const documentsAppRoutes = [documentsRoute, documentDetailRoute] as const;
