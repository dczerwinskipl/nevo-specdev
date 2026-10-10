import { useRouter } from '@tanstack/react-router';
import type { SpecFlowAppServices } from '../services';

/** Use the application's already-composed Router dependencies, not a parallel DI Context. */
export function useAppServices(): SpecFlowAppServices {
  const router = useRouter({ warn: false });
  if (!router) throw new Error('useAppServices requires the SpecFlow Router context');
  return router.options.context.services;
}
