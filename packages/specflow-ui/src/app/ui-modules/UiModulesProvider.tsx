import { createContext, useContext, type ReactNode } from 'react';
import type { UiRegistry } from './registry';

/** Explicit composition: tests, Storybook and production provide their own registry. */
const UiRegistryContext = createContext<UiRegistry | null>(null);

export interface UiModulesProviderProps {
  readonly modules: UiRegistry;
  readonly children: ReactNode;
}

export function UiModulesProvider({ modules, children }: UiModulesProviderProps) {
  return <UiRegistryContext.Provider value={modules}>{children}</UiRegistryContext.Provider>;
}

export function useUiModules(): UiRegistry {
  const registry = useContext(UiRegistryContext);
  if (!registry) throw new Error('UiModulesProvider is required to render UI contributions.');
  return registry;
}
