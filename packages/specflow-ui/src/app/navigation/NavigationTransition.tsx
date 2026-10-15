import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';
const NavigationTransitionContext = createContext({
  guardPending: false,
  setGuardPending: (_pending: boolean): void => undefined,
});
/** Shares only the in-flight route leave check between the router bridge and picker. */
export function NavigationTransitionProvider({ children }: PropsWithChildren) {
  const [guardPending, setGuardPending] = useState(false);
  const value = useMemo(() => ({ guardPending, setGuardPending }), [guardPending]);
  return (
    <NavigationTransitionContext.Provider value={value}>
      {children}
    </NavigationTransitionContext.Provider>
  );
}
export const useNavigationTransition = () => useContext(NavigationTransitionContext);
