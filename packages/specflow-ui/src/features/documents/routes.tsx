import { createRoute, Link, useRouterState } from '@tanstack/react-router';
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
  const { collection } = documentDetailRoute.useSearch();
  const { t } = useTranslation();
  const from = useRouterState({ select: (state) => state.location.state.specflowDocumentReturnTo });
  return (
    <AppWorkspace split="primary">
      <AppWorkspace.Primary header={<WorkspaceHeader title={documentId} />}>
        <AppContent className="w-content-xwide max-w-full">
          <AppWorkspaceBody className="py-6">
            <AppContentContainer align="start" size="full">
              <div className="grid max-w-content-standard gap-6">
                {from === 'overview' ? (
                  <Link
                    to="/specs/$specId"
                    params={{ specId }}
                    search={{ collection }}
                    className="w-fit text-body-sm font-medium text-accent-primary"
                  >
                    {t('specification.backToSpecification')}
                  </Link>
                ) : (
                  <Link
                    to="/specs/$specId/documents"
                    params={{ specId }}
                    search={{ collection }}
                    className="w-fit text-body-sm font-medium text-accent-primary"
                  >
                    {t('specification.backToDocuments')}
                  </Link>
                )}
                <DocumentContent specId={specId} documentId={documentId} />
              </div>
            </AppContentContainer>
          </AppWorkspaceBody>
        </AppContent>
      </AppWorkspace.Primary>
    </AppWorkspace>
  );
}

export const documentsAppRoutes = [documentsRoute, documentDetailRoute] as const;
