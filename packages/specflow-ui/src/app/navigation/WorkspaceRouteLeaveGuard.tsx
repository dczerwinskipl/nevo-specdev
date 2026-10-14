import { useBlocker, useRouter } from '@tanstack/react-router';
import { useSecondaryNavigation } from '@nevo/ui';
import { useRef } from 'react';
import { useNavigationTransition } from './NavigationTransition';
/** Product bridge only. The existing Secondary stack still owns its guards. */
export function WorkspaceRouteLeaveGuard() {
  const router = useRouter({ warn: false });
  return router ? <RoutedGuard /> : null;
}
function RoutedGuard() {
  const { canLeaveScope } = useSecondaryNavigation();
  const { setGuardPending } = useNavigationTransition();
  const checking = useRef(false);
  useBlocker({
    shouldBlockFn: async ({ current, next }) => {
      if (current.pathname === next.pathname) return false;
      if (checking.current) return true;
      checking.current = true;
      setGuardPending(true);
      try {
        return !(await canLeaveScope());
      } finally {
        checking.current = false;
        setGuardPending(false);
      }
    },
    enableBeforeUnload: false,
  });
  return null;
}
