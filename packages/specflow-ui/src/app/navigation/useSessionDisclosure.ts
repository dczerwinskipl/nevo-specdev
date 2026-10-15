import { useCallback, useEffect, useState } from 'react';
import type { SessionNavigationSummary } from '../../features/sessions/navigation/summary';

export function useSessionDisclosure(
  specId: string | null,
  summary: SessionNavigationSummary,
  preferences: ReadonlyMap<string, boolean>,
  onPreference: (id: string, expanded: boolean) => void,
) {
  const attention = summary.state === 'available' && summary.attention;
  useEffect(() => {
    if (specId && !preferences.has(specId) && summary.state === 'available')
      onPreference(specId, attention);
  }, [specId, preferences, onPreference, summary.state, attention]);
  return Boolean(specId && (preferences.get(specId) ?? attention));
}

/** Shell owns this lifetime, including when the mobile Drawer unmounts its content. */
export function useSessionDisclosurePreferences() {
  const [preferences, setPreferences] = useState<ReadonlyMap<string, boolean>>(() => new Map());
  const setExpanded = useCallback((id: string, expanded: boolean) => {
    setPreferences((previous) => new Map(previous).set(id, expanded));
  }, []);
  return { preferences, setExpanded };
}
export type SessionDisclosurePreferences = ReturnType<typeof useSessionDisclosurePreferences>;
