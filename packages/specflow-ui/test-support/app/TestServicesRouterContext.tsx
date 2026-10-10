import { createMemoryHistory, RouterContextProvider } from '@tanstack/react-router';
import { useMemo, type ReactNode } from 'react';
import { createSpecFlowRouter } from '../../src/app/router';
import type { SpecFlowAppServices } from '../../src/services';

/** Test-only real Router context; production does not carry a second services provider. */
export function TestServicesRouterContext({
  services,
  children,
}: {
  readonly services: SpecFlowAppServices;
  readonly children: ReactNode;
}) {
  const router = useMemo(
    () => createSpecFlowRouter(createMemoryHistory({ initialEntries: ['/'] }), services),
    [services],
  );
  return <RouterContextProvider router={router}>{children}</RouterContextProvider>;
}
