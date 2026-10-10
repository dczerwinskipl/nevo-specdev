import { createMemoryHistory } from '@tanstack/react-router';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createSpecFlowRouter } from '../app/router';
import { useAppServices } from '../app/useAppServices';
import { TestServicesRouterContext } from '../../test-support/app/TestServicesRouterContext';
import { createSpecFlowAppServices } from './index';

describe('SpecFlow application services composition', () => {
  it('fails without a Router context rather than falling back to production services', () => {
    function Consumer() {
      useAppServices();
      return null;
    }

    expect(() => renderToStaticMarkup(<Consumer />)).toThrow(
      'useAppServices requires the SpecFlow Router context',
    );
  });

  it('uses the explicitly supplied instance in a connected component', () => {
    const services = createSpecFlowAppServices();
    function Consumer() {
      return <span>{useAppServices() === services ? 'same' : 'different'}</span>;
    }

    expect(
      renderToStaticMarkup(
        <TestServicesRouterContext services={services}>
          <Consumer />
        </TestServicesRouterContext>,
      ),
    ).toContain('same');
  });

  it('shares Router dependencies and connected feature APIs without a second provider', () => {
    const services = createSpecFlowAppServices();
    const router = createSpecFlowRouter(
      createMemoryHistory({ initialEntries: ['/login'] }),
      services,
    );

    function Consumer() {
      const fromRouter = useAppServices();
      return <span>{fromRouter.taskApi === services.taskApi ? 'same' : 'different'}</span>;
    }

    const markup = renderToStaticMarkup(
      <TestServicesRouterContext services={services}>
        <Consumer />
      </TestServicesRouterContext>,
    );

    expect(markup).toContain('same');
    expect(router.options.context.auth).toBe(services.authStore);
    expect(router.options.context.specs).toBe(services.specsOverviewApi);
  });
});
