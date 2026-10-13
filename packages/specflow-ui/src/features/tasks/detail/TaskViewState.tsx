import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

interface TaskViewState {
  descriptionExpanded?: boolean;
  descriptionScroll?: number;
  requirementsExpanded?: boolean;
  resourcesExpanded?: boolean;
  scrollTop?: number;
  historyScroll?: number;
  inspectionScroll?: Record<string, number>;
  historyExpanded?: Record<string, string>;
  inspectionDisclosures?: Record<string, boolean>;
  inspectionCopyStatus?: Record<string, 'copied' | 'failed'>;
}
const Context = createContext<Map<string, TaskViewState> | null>(null);
export function TaskViewStateProvider({ children }: { readonly children: ReactNode }) {
  const store = useRef(new Map<string, TaskViewState>());
  return <Context.Provider value={store.current}>{children}</Context.Provider>;
}
export function useTaskViewState(taskId: string) {
  const store = useContext(Context);
  const [state, setState] = useState<TaskViewState>(() => store?.get(taskId) ?? {});
  const update = useCallback(
    (patch: TaskViewState | ((previous: TaskViewState) => TaskViewState)) => {
      setState((previous) => {
        const current = store?.get(taskId) ?? previous;
        const next = { ...current, ...(typeof patch === 'function' ? patch(current) : patch) };
        store?.set(taskId, next);
        return next;
      });
    },
    [store, taskId],
  );
  const saveScroll = useCallback(
    (top: number) => {
      store?.set(taskId, { ...store.get(taskId), scrollTop: top });
    },
    [store, taskId],
  );
  const saveHistoryScroll = useCallback(
    (top: number) => {
      store?.set(taskId, { ...store.get(taskId), historyScroll: top });
    },
    [store, taskId],
  );
  const saveInspectionScroll = useCallback(
    (key: string, top: number) => {
      const previous = store?.get(taskId);
      store?.set(taskId, {
        ...previous,
        inspectionScroll: { ...previous?.inspectionScroll, [key]: top },
      });
    },
    [store, taskId],
  );
  return { state, update, saveScroll, saveHistoryScroll, saveInspectionScroll };
}
