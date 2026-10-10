import { useCallback, useState } from 'react';

export interface UseSpecificationDialogsOptions {
  readonly onExecute?: (agent: string, tasks: readonly string[]) => void | Promise<void>;
  readonly onNewConversation?: (agent: string) => void | Promise<void>;
}

export interface UseSpecificationDialogsResult {
  readonly executeDialogOpen: boolean;
  readonly conversationDialogOpen: boolean;
  readonly tasksToExecute: readonly string[];
  readonly openExecuteDialog: (tasks: readonly string[]) => void;
  readonly closeExecuteDialog: () => void;
  readonly handleConfirmExecute: (agent: string) => void;
  readonly openConversationDialog: () => void;
  readonly closeConversationDialog: () => void;
  readonly handleConfirmConversation: (agent: string) => void;
}

/**
 * Encapsulates modal dialog state and dispatching for Specification Workspace actions
 * (task batch execution and new agent conversation).
 */
export function useSpecificationDialogs({
  onExecute,
  onNewConversation,
}: UseSpecificationDialogsOptions): UseSpecificationDialogsResult {
  const [executeDialogOpen, setExecuteDialogOpen] = useState(false);
  const [conversationDialogOpen, setConversationDialogOpen] = useState(false);
  const [tasksToExecute, setTasksToExecute] = useState<readonly string[]>([]);

  const openExecuteDialog = useCallback((tasks: readonly string[]) => {
    setTasksToExecute(tasks);
    setExecuteDialogOpen(true);
  }, []);

  const closeExecuteDialog = useCallback(() => {
    setExecuteDialogOpen(false);
  }, []);

  const handleConfirmExecute = useCallback(
    (agent: string) => {
      setExecuteDialogOpen(false);
      void onExecute?.(agent, Array.from(tasksToExecute));
    },
    [onExecute, tasksToExecute],
  );

  const openConversationDialog = useCallback(() => {
    setConversationDialogOpen(true);
  }, []);

  const closeConversationDialog = useCallback(() => {
    setConversationDialogOpen(false);
  }, []);

  const handleConfirmConversation = useCallback(
    (agent: string) => {
      setConversationDialogOpen(false);
      void onNewConversation?.(agent);
    },
    [onNewConversation],
  );

  return {
    executeDialogOpen,
    conversationDialogOpen,
    tasksToExecute,
    openExecuteDialog,
    closeExecuteDialog,
    handleConfirmExecute,
    openConversationDialog,
    closeConversationDialog,
    handleConfirmConversation,
  };
}
