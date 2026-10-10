import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';

import { defaultQueryClient } from './app/queryClient';
import { builtInUiModuleRegistry } from './app/ui-modules/builtInUiModules';
import { UiModulesProvider } from './app/ui-modules/UiModulesProvider';
import { AuthQueryCacheBoundary } from './app/AuthQueryCacheBoundary';
import { router } from './app/router';
import { LocalizationProvider } from './i18n';
import { defaultSpecFlowServices } from './services';

export function App() {
  return (
    <QueryClientProvider client={defaultQueryClient}>
      <UiModulesProvider modules={builtInUiModuleRegistry}>
        <AuthQueryCacheBoundary auth={defaultSpecFlowServices.authStore}>
          <LocalizationProvider>
            <RouterProvider router={router} />
          </LocalizationProvider>
        </AuthQueryCacheBoundary>
      </UiModulesProvider>
    </QueryClientProvider>
  );
}
