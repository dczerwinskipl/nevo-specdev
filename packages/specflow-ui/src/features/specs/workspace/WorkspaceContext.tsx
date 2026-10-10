import { createContext, useContext, type ReactNode } from 'react';

/** Semantic operations provided by the specification workspace host. */
export interface WorkspaceRuntime {
  readonly previewTask: (taskId: string) => void;
  readonly openTask: (taskId: string) => void;
  readonly openSession: (sessionId: string) => void;
  readonly openSessionsView: () => void;
  readonly openDoc: (docId: string, origin?: 'work' | 'documents') => void;
  readonly openDocumentsView: () => void;
  readonly openRepository: () => void;
  readonly openChanges: (source?: 'base' | 'uncommitted' | 'mr') => void;
  readonly openHistory: () => void;
  readonly startConversation: (agent?: string) => void;
  readonly executeTasks: (taskIds: readonly string[], agent?: string) => void;
  readonly refresh: () => void | Promise<void>;
  readonly fullTaskHref: (taskId: string) => string;
  readonly canExecute?: boolean;
  readonly canStartConversation?: boolean;
  readonly canOpenSession?: boolean;
}

const WorkspaceRuntimeContext = createContext<WorkspaceRuntime | null>(null);

export interface WorkspaceProviderProps {
  readonly runtime: WorkspaceRuntime;
  readonly children: ReactNode;
}

/** Provides the WorkspaceRuntime to the workspace component tree. */
export function WorkspaceProvider({ runtime, children }: WorkspaceProviderProps) {
  return (
    <WorkspaceRuntimeContext.Provider value={runtime}>{children}</WorkspaceRuntimeContext.Provider>
  );
}

/** Hook to consume the semantic WorkspaceRuntime from any workspace section or control. */
export function useWorkspaceRuntime(): WorkspaceRuntime {
  const context = useContext(WorkspaceRuntimeContext);
  if (!context) {
    throw new Error('useWorkspaceRuntime must be used within a WorkspaceProvider');
  }
  return context;
}

const noop = () => undefined;

/** Creates a fake WorkspaceRuntime for testing and Storybook fixtures. */
export function createFakeWorkspaceRuntime(
  overrides: Partial<WorkspaceRuntime> = {},
): WorkspaceRuntime {
  return {
    previewTask: noop,
    openTask: noop,
    openSession: noop,
    openSessionsView: noop,
    openDoc: noop,
    openDocumentsView: noop,
    openRepository: noop,
    openChanges: noop,
    openHistory: noop,
    startConversation: noop,
    executeTasks: noop,
    refresh: noop,
    fullTaskHref: (taskId) => `/specs/fake/tasks/${encodeURIComponent(taskId)}`,
    canExecute: true,
    canStartConversation: true,
    canOpenSession: true,
    ...overrides,
  };
}
