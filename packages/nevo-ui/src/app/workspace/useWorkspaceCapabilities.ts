import { useAppWorkspace } from '../shell/AppShell';
import { supportsRuntimeWorkspaceSplit } from './workspaceSizing';

/** Uses the same measured workspace width and threshold as AppWorkspace. */
export function useWorkspaceCapabilities() {
  const { availableWidth } = useAppWorkspace();
  return { supportsSplit: supportsRuntimeWorkspaceSplit(availableWidth) };
}
