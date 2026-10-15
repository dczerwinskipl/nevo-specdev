import { useEffect } from 'react';
import { useRouter } from '@tanstack/react-router';
import { useAppNavigation } from '@nevo/ui';

/** Route commits dismiss an open Drawer. Query changes retain the user's focus. */
export function useNavigationFocus() {
  const router = useRouter();
  const { closeNavigation, navigationOpen } = useAppNavigation();
  useEffect(
    () =>
      router.subscribe('onResolved', ({ pathChanged }) => {
        if (!navigationOpen) return;
        closeNavigation(
          pathChanged
            ? () => document.querySelector<HTMLElement>('[data-workspace-active="true"] h1')
            : undefined,
        );
      }),
    [router, closeNavigation, navigationOpen],
  );
}
