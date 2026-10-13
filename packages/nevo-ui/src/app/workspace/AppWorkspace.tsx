import {
  Children,
  Fragment,
  isValidElement,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type AnimationEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';

import { IconButton } from '../../components/actions/IconButton';
import { ScrollArea } from '../../components/layout/ScrollArea';
import { DrawerTrigger } from '../../components/overlays/Drawer';
import { workspaceSurfaceClassName } from '../../design-system/brandEnvironment';
import { cn } from '../../lib';
import { useAppWorkspace } from '../shell/AppShell';
import { AppContentScrollProvider } from './AppContent';
import { useOptionalWorkspace } from './WorkspaceContext';
import type { WorkspaceTransition } from './WorkspaceContext';
import {
  resolveSlotMaxWidth,
  resolveWorkspaceSplit,
  supportsRuntimeWorkspaceSplit,
  type AppWorkspaceSplitMode,
} from './workspaceSizing';
import type { AppWorkspaceSurface } from './workspaceSurface';
import {
  useMobileWorkspaceTransition,
  workspaceSurfaceRuntimeAttributes,
  type MobileWorkspaceSurfaceRuntime,
} from './useMobileWorkspaceTransition';
import {
  CompactWorkspaceActions,
  WorkspaceHeader,
  type WorkspaceHeaderAction,
  type WorkspaceHeaderActionTone,
  type WorkspaceHeaderProps,
} from './WorkspaceHeader';

export { WorkspaceHeaderIdentity } from './WorkspaceHeader';

export interface AppWorkspaceLabels {
  backToPrimary: string;
  closeSecondary: string;
  openNavigation: string;
}

export interface AppWorkspaceRegionProps {
  header?: ReactNode;
  children: ReactNode;
}

export interface AppWorkspaceSecondaryRegionProps extends AppWorkspaceRegionProps {
  /**
   * Controls whether the declarative/default Secondary is visible on split-capable layouts.
   * Defaults to true. The default Secondary never auto-stacks on narrow layouts.
   */
  open?: boolean;
  /**
   * When provided, the split Secondary gets a Close action that requests open=false.
   * Consumers can restore the default Secondary later by rendering it with open=true.
   */
  onOpenChange?: (open: boolean) => void;
}

interface CommonAppWorkspaceProps {
  split?: AppWorkspaceSplitMode;
  labels?: Partial<AppWorkspaceLabels>;
  /** Close the active page (returning to its parent) or the entire contextual flow. */
  secondaryCloseBehavior?: 'page' | 'flow';
}

export type AppWorkspaceProps = CommonAppWorkspaceProps & {
  children: ReactNode;
};

const defaultAppWorkspaceLabels: AppWorkspaceLabels = {
  backToPrimary: 'Back',
  closeSecondary: 'Close secondary content',
  openNavigation: 'Open navigation',
};

interface WorkspaceSecondaryPresentation {
  surface: AppWorkspaceSurface;
  key: string;
  canStack: boolean;
  transition?: WorkspaceTransition;
  onClose?: () => void | Promise<unknown>;
  onBack?: () => void | Promise<unknown>;
}

function SurfaceBoundary({
  surface,
  children,
}: {
  surface: AppWorkspaceSurface;
  children: ReactNode;
}) {
  return surface.wrap ? surface.wrap(children) : children;
}

interface WorkspaceLayoutState {
  mode: 'split' | 'stacked';
  showSecondary: boolean;
  primaryMaxWidth?: number;
  secondaryMaxWidth?: number;
}

function AppWorkspacePrimary(_props: AppWorkspaceRegionProps) {
  return null;
}

function AppWorkspaceSecondary(_props: AppWorkspaceSecondaryRegionProps) {
  return null;
}

function flattenWorkspaceChildren(children: ReactNode): ReactElement[] {
  const result: ReactElement[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;

    if (child.type === Fragment) {
      flattenWorkspaceChildren((child.props as { children?: ReactNode }).children).forEach(
        (nested) => result.push(nested),
      );
      return;
    }

    result.push(child);
  });

  return result;
}

interface ComposedDefaultSecondary {
  surface: AppWorkspaceSurface;
  open: boolean;
  onOpenChange?: (open: boolean) => void;
}

function resolveComposedWorkspace(children: ReactNode): {
  primary: AppWorkspaceSurface;
  defaultSecondary?: ComposedDefaultSecondary;
} {
  let primary: AppWorkspaceSurface | undefined;
  let defaultSecondary: ComposedDefaultSecondary | undefined;

  for (const child of flattenWorkspaceChildren(children)) {
    if (child.type === AppWorkspacePrimary) {
      if (primary) {
        throw new Error('AppWorkspace accepts only one AppWorkspace.Primary.');
      }
      const props = child.props as AppWorkspaceRegionProps;
      primary = { header: props.header, content: props.children };
    } else if (child.type === AppWorkspaceSecondary) {
      if (defaultSecondary) {
        throw new Error('AppWorkspace accepts only one AppWorkspace.Secondary.');
      }
      const props = child.props as AppWorkspaceSecondaryRegionProps;
      defaultSecondary = {
        surface: { header: props.header, content: props.children },
        open: props.open ?? true,
        onOpenChange: props.onOpenChange,
      };
    } else {
      throw new Error(
        'AppWorkspace children must be AppWorkspace.Primary or AppWorkspace.Secondary.',
      );
    }
  }

  if (!primary) {
    throw new Error('AppWorkspace requires AppWorkspace.Primary.');
  }

  return { primary, defaultSecondary };
}

function useWorkspaceLayoutState(
  split: AppWorkspaceSplitMode,
  hasSecondary: boolean,
  secondaryCanStack: boolean,
): WorkspaceLayoutState {
  const { availableWidth } = useAppWorkspace();
  const isSplitView = supportsRuntimeWorkspaceSplit(availableWidth);
  const showSecondary = hasSecondary && (isSplitView || secondaryCanStack);
  const resolvedSplit = resolveWorkspaceSplit(split, isSplitView && showSecondary, availableWidth);

  return {
    mode: isSplitView ? 'split' : 'stacked',
    showSecondary,
    primaryMaxWidth: resolveSlotMaxWidth(availableWidth, resolvedSplit.primary),
    secondaryMaxWidth:
      resolvedSplit.secondary === 0
        ? undefined
        : resolveSlotMaxWidth(availableWidth, resolvedSplit.secondary),
  };
}

function NavigationAction({ label }: { label: string }) {
  return (
    <DrawerTrigger asChild>
      <IconButton aria-label={label} icon="menu" variant="ghost" />
    </DrawerTrigger>
  );
}

function BackAction({ label, onBack }: { label: string; onBack: () => void | Promise<unknown> }) {
  return (
    <IconButton
      aria-label={label}
      className="[&_svg]:rotate-180"
      icon="arrow-right"
      onClick={() => void onBack()}
      variant="ghost"
    />
  );
}

function CloseAction({
  label,
  onClose,
}: {
  label: string;
  onClose: () => void | Promise<unknown>;
}) {
  return (
    <IconButton
      aria-label={label}
      icon="close"
      onClick={() => void onClose()}
      size="sm"
      variant="ghost"
    />
  );
}

function RuntimeSurfaceRegion({
  compactNavigationAction,
  divider = false,
  instanceKey,
  leadingAction,
  maxWidth,
  mobileRuntime,
  onMobileMotionComplete,
  stackedVisual,
  surface,
  surfaceName,
  trailingAction,
  surfaceRef,
  tabIndex,
}: {
  compactNavigationAction?: WorkspaceHeaderAction;
  divider?: boolean;
  instanceKey: string;
  leadingAction?: ReactNode;
  maxWidth?: number;
  mobileRuntime?: MobileWorkspaceSurfaceRuntime;
  onMobileMotionComplete?: (event: AnimationEvent<HTMLElement>) => void;
  stackedVisual: boolean;
  surface: AppWorkspaceSurface;
  surfaceName: 'primary' | 'secondary';
  trailingAction?: ReactNode;
  surfaceRef?: Ref<HTMLDivElement>;
  tabIndex?: number;
}) {
  const showHeader =
    surface.header !== undefined || leadingAction !== undefined || trailingAction !== undefined;

  if (stackedVisual) {
    if (!mobileRuntime?.mounted) return null;

    return (
      <MobileRuntimeSurfaceRegion
        compactNavigationAction={compactNavigationAction}
        instanceKey={instanceKey}
        key={mobileRuntime.instanceKey}
        leadingAction={leadingAction}
        maxWidth={maxWidth}
        onMotionComplete={onMobileMotionComplete}
        runtime={mobileRuntime}
        surface={surface}
        surfaceRef={surfaceRef}
        tabIndex={tabIndex}
        trailingAction={trailingAction}
      />
    );
  }

  return (
    <div
      className={cn(
        'min-w-0 flex-none overflow-hidden outline-none',
        'w-max max-w-full group-data-[workspace-fit=available]/workspace:w-full',
        divider && 'border-l border-border-subtle',
      )}
      data-workspace-active="true"
      data-workspace-instance={instanceKey}
      data-workspace-surface={surfaceName}
      ref={surfaceRef}
      tabIndex={tabIndex}
      style={{
        maxWidth: maxWidth === undefined ? '100%' : `${maxWidth}px`,
      }}
    >
      <div className="workspace-stack relative h-full min-h-0 min-w-0 overflow-hidden">
        <div className="flex h-full min-h-0 flex-col" data-workspace-layer={instanceKey}>
          <SurfaceBoundary surface={surface}>
            {showHeader ? (
              <div
                className={cn(
                  '@container flex h-14 shrink-0 items-center gap-2',
                  'border-b border-border-subtle px-4',
                )}
              >
                {leadingAction}
                <div className="min-w-0 flex-1">{surface.header}</div>
                {trailingAction}
              </div>
            ) : null}
            <div className="min-h-0 flex-1 overflow-hidden">{surface.content}</div>
          </SurfaceBoundary>
        </div>
      </div>
    </div>
  );
}

function MobileRuntimeSurfaceRegion({
  compactNavigationAction,
  instanceKey,
  leadingAction,
  maxWidth,
  onMotionComplete,
  runtime,
  surface,
  surfaceRef,
  tabIndex,
  trailingAction,
}: {
  compactNavigationAction?: WorkspaceHeaderAction;
  instanceKey: string;
  leadingAction?: ReactNode;
  maxWidth?: number;
  onMotionComplete?: (event: AnimationEvent<HTMLElement>) => void;
  runtime: MobileWorkspaceSurfaceRuntime;
  surface: AppWorkspaceSurface;
  surfaceRef?: Ref<HTMLDivElement>;
  tabIndex?: number;
  trailingAction?: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerCovered, setHeaderCovered] = useState(false);
  const headerCoveredRef = useRef(false);
  const showHeader =
    surface.header !== undefined || leadingAction !== undefined || trailingAction !== undefined;

  const updateHeaderCovered = useCallback(
    (scrollTop: number) => {
      const headerHeight = headerRef.current?.offsetHeight ?? 0;
      const covered = !showHeader || (headerHeight > 0 && scrollTop >= headerHeight - 0.5);

      if (rootRef.current) rootRef.current.dataset.headerCovered = String(covered);
      if (headerCoveredRef.current === covered) return;

      headerCoveredRef.current = covered;
      setHeaderCovered(covered);
    },
    [showHeader],
  );

  useLayoutEffect(() => {
    const root = rootRef.current;
    const viewport = viewportRef.current;
    if (!root || !viewport) return;

    const updateMetrics = () => {
      root.style.setProperty('--mobile-workspace-viewport-height', `${viewport.clientHeight}px`);
      root.style.setProperty(
        '--mobile-workspace-header-height',
        `${headerRef.current?.offsetHeight ?? 0}px`,
      );
      updateHeaderCovered(viewport.scrollTop);
    };
    const resizeObserver = new ResizeObserver(updateMetrics);
    resizeObserver.observe(viewport);
    if (headerRef.current) resizeObserver.observe(headerRef.current);
    updateMetrics();

    return () => resizeObserver.disconnect();
  }, [updateHeaderCovered]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTop = 0;
    updateHeaderCovered(0);
  }, [instanceKey, updateHeaderCovered]);

  const setSurfaceRef = useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node;
      if (typeof surfaceRef === 'function') surfaceRef(node);
      else if (surfaceRef) surfaceRef.current = node;
    },
    [surfaceRef],
  );

  return (
    <div
      className={cn(
        '@container absolute inset-0 min-w-0 overflow-hidden outline-none',
        'h-full w-full',
        runtime.surface === 'secondary' && 'bg-canvas bg-app-base',
        !runtime.visible && 'hidden',
      )}
      {...workspaceSurfaceRuntimeAttributes(runtime)}
      aria-hidden={!runtime.visible || !runtime.interactive || undefined}
      data-header-covered={headerCovered}
      inert={!runtime.interactive ? true : undefined}
      onAnimationEnd={onMotionComplete}
      ref={setSurfaceRef}
      tabIndex={tabIndex}
      style={{
        maxWidth: maxWidth === undefined ? '100%' : `${maxWidth}px`,
        zIndex: runtime.surface === 'secondary' ? (runtime.motion.phase === 'idle' ? 10 : 20) : 0,
      }}
    >
      <SurfaceBoundary surface={surface}>
        <ScrollArea
          className="mobile-workspace-scroll-area h-full"
          contentClassName="min-h-full"
          direction="vertical"
          onScroll={(event) => updateHeaderCovered(event.currentTarget.scrollTop)}
          startEdge={headerCovered ? 'auto' : 'hidden'}
          viewportClassName="mobile-workspace-scroll"
          viewportRef={viewportRef}
        >
          <div className="workspace-stack relative min-h-full min-w-0 overflow-hidden">
            <div
              className="workspace-stack__layer workspace-stack__layer--current flex min-h-full flex-col"
              data-workspace-layer={instanceKey}
            >
              <>
                {showHeader ? (
                  <div
                    aria-hidden={headerCovered || undefined}
                    className="@container flex h-14 shrink-0 items-center gap-2 px-3"
                    inert={headerCovered ? true : undefined}
                    ref={headerRef}
                  >
                    {leadingAction}
                    <div className="min-w-0 flex-1">{surface.header}</div>
                    {trailingAction}
                  </div>
                ) : null}

                <div className="mobile-workspace-sheet flex-1">
                  <div
                    className={cn(
                      workspaceSurfaceClassName,
                      'mobile-workspace-surface min-h-full overflow-hidden rounded-t-surface border border-b-0 border-workspace-edge',
                    )}
                  >
                    <AppContentScrollProvider>
                      <div className="min-h-full">{surface.content}</div>
                    </AppContentScrollProvider>
                  </div>
                </div>
              </>
            </div>
          </div>
        </ScrollArea>

        <div
          aria-hidden={!headerCovered || undefined}
          className="mobile-floating-navigation"
          inert={!headerCovered ? true : undefined}
        >
          {leadingAction}
          {surface.renderCompactActions ? (
            surface.renderCompactActions({
              className: 'mobile-floating-navigation__control',
              navigationAction: compactNavigationAction,
            })
          ) : (
            <CompactWorkspaceActions
              className="mobile-floating-navigation__control"
              header={surface.header}
              navigationAction={compactNavigationAction}
            />
          )}
        </div>
      </SurfaceBoundary>
    </div>
  );
}

function AppWorkspaceRoot({
  children,
  labels: labelsProp,
  split = 'balanced',
  secondaryCloseBehavior = 'flow',
}: AppWorkspaceProps) {
  const staticSurfaces = resolveComposedWorkspace(children);

  const workspace = useOptionalWorkspace();
  const { navigationMode } = useAppWorkspace();
  const runtimeSecondary = workspace?.secondary ?? null;
  const defaultSecondary = staticSurfaces.defaultSecondary;
  const defaultSecondaryOpen = defaultSecondary?.open ?? false;
  const secondaryPresentation: WorkspaceSecondaryPresentation | undefined = runtimeSecondary
    ? {
        surface: runtimeSecondary.surface,
        key: `runtime-${runtimeSecondary.instanceKey}`,
        canStack: true,
        transition: workspace?.transition,
        onClose: secondaryCloseBehavior === 'page' ? workspace?.back : workspace?.close,
        onBack: workspace?.back,
      }
    : defaultSecondaryOpen && defaultSecondary
      ? {
          surface: defaultSecondary.surface,
          key: 'default-secondary',
          canStack: false,
          transition: workspace?.transition,
          onClose: defaultSecondary.onOpenChange
            ? () => defaultSecondary.onOpenChange?.(false)
            : undefined,
        }
      : undefined;
  const outgoingSecondary = workspace?.transition.outgoing;
  const outgoingSecondaryPresentation = outgoingSecondary
    ? {
        surface: outgoingSecondary.surface,
        key: `runtime-${outgoingSecondary.instanceKey}`,
      }
    : undefined;
  const state = useWorkspaceLayoutState(
    split,
    secondaryPresentation !== undefined,
    secondaryPresentation?.canStack ?? false,
  );
  const mobileRuntime = useMobileWorkspaceTransition({
    secondaryInstanceKey:
      state.mode === 'stacked' && state.showSecondary ? secondaryPresentation?.key : undefined,
    transition:
      state.mode === 'stacked' && state.showSecondary
        ? secondaryPresentation?.transition
        : undefined,
  });
  const secondaryRegionRef = useRef<HTMLDivElement>(null);
  const labels = { ...defaultAppWorkspaceLabels, ...labelsProp };
  const primaryNavigationAction =
    navigationMode === 'drawer' ? <NavigationAction label={labels.openNavigation} /> : undefined;
  const secondaryBackAction =
    secondaryPresentation?.onBack &&
    (state.mode === 'stacked' ||
      workspace?.canGoBack ||
      (state.mode === 'split' && secondaryPresentation.canStack)) ? (
      <BackAction label={labels.backToPrimary} onBack={secondaryPresentation.onBack} />
    ) : undefined;
  const secondaryCloseAction = secondaryPresentation?.onClose ? (
    <CloseAction label={labels.closeSecondary} onClose={secondaryPresentation.onClose} />
  ) : undefined;
  const compactSecondaryCloseAction: WorkspaceHeaderAction | undefined =
    secondaryPresentation?.onClose
      ? {
          id: 'close-secondary-navigation',
          label: labels.closeSecondary,
          icon: 'close',
          onPress: () => void secondaryPresentation.onClose?.(),
        }
      : undefined;
  const outgoingBackAction = outgoingSecondaryPresentation ? (
    <BackAction label={labels.backToPrimary} onBack={() => undefined} />
  ) : undefined;
  const outgoingCloseAction = outgoingSecondaryPresentation ? (
    <CloseAction label={labels.closeSecondary} onClose={() => undefined} />
  ) : undefined;

  useLayoutEffect(() => {
    if (!secondaryPresentation?.canStack) return;
    if (
      secondaryPresentation.transition?.action !== 'push' &&
      secondaryPresentation.transition?.action !== 'replace'
    ) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const target = secondaryRegionRef.current?.querySelector<HTMLElement>(
        '[data-workspace-header-title="true"]',
      );
      (target ?? secondaryRegionRef.current)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [
    secondaryPresentation?.canStack,
    secondaryPresentation?.key,
    secondaryPresentation?.transition?.action,
    secondaryPresentation?.transition?.revision,
  ]);

  return (
    <div
      className={cn(
        'group/workspace relative flex h-full max-w-full items-stretch overflow-hidden',
        state.mode === 'split' && navigationMode === 'drawer' && workspaceSurfaceClassName,
      )}
      data-layout={state.mode}
      data-workspace-fit={state.mode === 'split' && state.showSecondary ? 'content' : 'available'}
      style={{
        width: state.mode === 'split' && state.showSecondary ? 'max-content' : '100%',
      }}
    >
      <RuntimeSurfaceRegion
        instanceKey="primary"
        leadingAction={primaryNavigationAction}
        maxWidth={state.primaryMaxWidth}
        mobileRuntime={state.mode === 'stacked' ? mobileRuntime.primary : undefined}
        onMobileMotionComplete={mobileRuntime.completeMotion}
        stackedVisual={state.mode === 'stacked'}
        surface={staticSurfaces.primary}
        surfaceName="primary"
      />

      {state.showSecondary && secondaryPresentation ? (
        <RuntimeSurfaceRegion
          compactNavigationAction={compactSecondaryCloseAction}
          divider={state.mode === 'split'}
          instanceKey={secondaryPresentation.key}
          key={secondaryPresentation.key}
          leadingAction={secondaryBackAction}
          maxWidth={state.mode === 'split' ? state.secondaryMaxWidth : undefined}
          mobileRuntime={state.mode === 'stacked' ? mobileRuntime.secondary : undefined}
          onMobileMotionComplete={mobileRuntime.completeMotion}
          stackedVisual={state.mode === 'stacked'}
          surface={secondaryPresentation.surface}
          surfaceName="secondary"
          surfaceRef={secondaryRegionRef}
          tabIndex={state.mode === 'stacked' ? -1 : undefined}
          trailingAction={secondaryCloseAction}
        />
      ) : null}

      {state.mode === 'stacked' &&
      mobileRuntime.outgoingSecondary.mounted &&
      outgoingSecondaryPresentation ? (
        <RuntimeSurfaceRegion
          instanceKey={outgoingSecondaryPresentation.key}
          key={`outgoing-${outgoingSecondaryPresentation.key}`}
          leadingAction={outgoingBackAction}
          maxWidth={undefined}
          mobileRuntime={mobileRuntime.outgoingSecondary}
          onMobileMotionComplete={mobileRuntime.completeMotion}
          stackedVisual
          surface={outgoingSecondaryPresentation.surface}
          surfaceName="secondary"
          trailingAction={outgoingCloseAction}
        />
      ) : null}
    </div>
  );
}

export const AppWorkspace = Object.assign(AppWorkspaceRoot, {
  Primary: AppWorkspacePrimary,
  Secondary: AppWorkspaceSecondary,
});

export {
  WorkspaceHeader,
  type WorkspaceHeaderAction,
  type WorkspaceHeaderActionTone,
  type WorkspaceHeaderProps,
};

export {
  AppContent,
  AppContentContainer,
  AppWorkspaceBody,
  AppWorkspaceHeader,
  type AppContentContainerProps,
  type AppContentContainerSize,
} from './AppContent';
export {
  AppWorkspaceSlots,
  type AppWorkspaceSlot,
  type AppWorkspaceSlotsProps,
} from './AppWorkspaceSlots';
