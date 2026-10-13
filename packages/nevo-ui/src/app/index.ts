export {
  AppShell,
  useAppNavigation,
  type AppNavigationMode,
  type AppShellProps,
} from './shell/AppShell';
export { StandaloneShell, type StandaloneShellProps } from './shell/StandaloneShell';
export {
  AppContent,
  AppContentContainer,
  AppWorkspace,
  AppWorkspaceBody,
  AppWorkspaceHeader,
  AppWorkspaceSlots,
  WorkspaceHeader,
  WorkspaceHeaderIdentity,
  type AppWorkspaceProps,
  type AppWorkspaceSlot,
  type AppWorkspaceSlotsProps,
  type WorkspaceHeaderAction,
  type WorkspaceHeaderActionTone,
  type WorkspaceHeaderProps,
} from './workspace/AppWorkspace';
export {
  AppWorkspaceProvider,
  useSecondaryNavigation,
  useSecondaryStack,
  useSecondaryLeaveGuard,
} from './workspace/WorkspaceContext';
export {
  defineSecondaryStack,
  type SecondaryData,
  type SecondaryScreenProps,
  type SecondaryStackDefinition,
  type SecondaryStackActions,
} from './workspace/SecondaryStack';
export type { AppWorkspaceSurface } from './workspace/workspaceSurface';
export type {
  AppWorkspaceSplitMode,
  AppWorkspaceShare,
  AppWorkspaceSplit,
} from './workspace/workspaceSizing';
export { APP_NAVIGATION_INLINE_PADDING, APP_SHELL_GAP } from './workspace/workspaceSizing';
export * from './floating';
export { useWorkspaceCapabilities } from './workspace/useWorkspaceCapabilities';
export type {
  AppContentContainerSize,
  AppWorkspaceRegionProps,
  AppWorkspaceSecondaryRegionProps,
} from './workspace/AppWorkspace';
