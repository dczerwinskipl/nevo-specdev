import { createRoute } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { specificationRoute } from '../specs/routes';
import { parseSpecificationCollection } from '../../app/router/search';
import { SpecificationAggregatePage } from '../specs/pages/SpecificationAggregatePage';
import { SessionsView } from './views/SessionsView';

export const sessionsRoute = createRoute({
  getParentRoute: () => specificationRoute,
  path: 'sessions',
  validateSearch: (search: Record<string, unknown>) => ({
    collection: parseSpecificationCollection(search),
  }),
  component: SessionsRouteScreen,
});

function SessionsRouteScreen() {
  const { specId } = sessionsRoute.useParams();
  const { t } = useTranslation();
  return (
    <SpecificationAggregatePage
      specId={specId}
      title={t('specification.viewSessions')}
      section="sessions"
    >
      {(data) => <SessionsView sessions={data.sessions} />}
    </SpecificationAggregatePage>
  );
}

export const sessionsAppRoutes = [sessionsRoute] as const;
