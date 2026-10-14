import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
} from 'react';

import {
  DesignMetadataBoundary,
  designSlot,
  useDesignMetadata,
} from '@nevo/figma-capture/metadata';
import { AppBackground, WorkspaceSurface } from '../../components/foundations/Environment';
import { Drawer, DrawerContent, DrawerTitle } from '../../components/overlays/Drawer';
import { cn } from '../../lib';
import { AppFloatingOutlet, AppFloatingProvider } from '../floating/AppFloating';
import {
  APP_NAVIGATION_WIDTH,
  APP_SHELL_GAP,
  WIDE_SHELL_MIN_WIDTH,
} from '../workspace/workspaceSizing';

export type AppNavigationMode = 'persistent' | 'drawer';

interface AppWorkspaceContextValue {
  availableWidth?: number;
  navigationMode: AppNavigationMode;
}

const AppWorkspaceContext = createContext<AppWorkspaceContextValue>({
  navigationMode: 'drawer',
});

export function useAppWorkspace() {
  return useContext(AppWorkspaceContext);
}

interface AppNavigationContextValue {
  closeNavigation: (focusTarget?: () => HTMLElement | null) => void;
}

const AppNavigationContext = createContext<AppNavigationContextValue>({
  closeNavigation: () => undefined,
});

export function useAppNavigation() {
  return useContext(AppNavigationContext);
}

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState<number>();

  useLayoutEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    const update = () => setWidth(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(update);

    observer.observe(element);
    update();

    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

function useDescendantWidth<T extends HTMLElement>(
  rootRef: RefObject<T | null>,
  selector: string,
  enabled: boolean,
) {
  const [width, setWidth] = useState<number>();

  useLayoutEffect(() => {
    if (!enabled) {
      setWidth(undefined);
      return;
    }

    const element = rootRef.current?.querySelector<HTMLElement>(selector);
    if (!element) return;

    const update = () => setWidth(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(update);

    observer.observe(element);
    update();

    return () => observer.disconnect();
  }, [enabled, rootRef, selector]);

  return width;
}

export interface AppShellProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  brandPrimary?: string;
  navigation: ReactNode;
  children: ReactNode;
  labels?: Partial<AppShellLabels>;
}

export interface AppShellLabels {
  closeNavigation: string;
  navigationTitle: string;
}

const defaultAppShellLabels: AppShellLabels = {
  closeNavigation: 'Close navigation',
  navigationTitle: 'Application navigation',
};

export function resolveAppShellLayout(width: number | undefined) {
  const wide = width !== undefined && width >= WIDE_SHELL_MIN_WIDTH;
  return {
    availableWidth:
      width === undefined
        ? undefined
        : Math.max(0, width - (wide ? APP_NAVIGATION_WIDTH + APP_SHELL_GAP : 0)),
    navigationMode: wide ? ('persistent' as const) : ('drawer' as const),
    workspaceMaterialOwner: wide ? ('shell' as const) : ('panel' as const),
    wide,
  };
}

export function AppShell({
  brandPrimary,
  navigation,
  children,
  className,
  labels: labelsProp,
  style,
  ...props
}: AppShellProps) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const navigationOpenRef = useRef(false);
  const navigationOpener = useRef<HTMLElement | null>(null);
  const navigationFocusTarget = useRef<(() => HTMLElement | null) | undefined>(undefined);
  const { ref: shellRef, width: shellWidth } = useElementWidth<HTMLDivElement>();
  const { availableWidth, navigationMode, workspaceMaterialOwner, wide } =
    resolveAppShellLayout(shellWidth);
  const labels = { ...defaultAppShellLabels, ...labelsProp };
  const capture = useDesignMetadata('AppShell', { viewport: 'desktop' });
  const workspaceWidth = useDescendantWidth(shellRef, '[data-app-shell-region="workspace"]', wide);
  const isDesignCapture =
    'data-design-capture' in capture && capture['data-design-capture'] === 'true';
  const workspaceIsInset =
    !isDesignCapture &&
    wide &&
    availableWidth !== undefined &&
    workspaceWidth !== undefined &&
    workspaceWidth < availableWidth - 1;
  const closeNavigation = useCallback((focusTarget?: () => HTMLElement | null) => {
    if (navigationOpenRef.current) navigationFocusTarget.current = focusTarget;
    navigationOpenRef.current = false;
    setNavigationOpen(false);
  }, []);
  const navigationContext = useMemo(() => ({ closeNavigation }), [closeNavigation]);
  const workspaceContext = useMemo<AppWorkspaceContextValue>(
    () => ({ availableWidth, navigationMode }),
    [availableWidth, navigationMode],
  );
  const geometryStyle = {
    '--app-navigation-width': `${APP_NAVIGATION_WIDTH}px`,
    '--app-shell-gap': wide ? `${APP_SHELL_GAP}px` : '0px',
    height: '100dvh',
    ...style,
  } as CSSProperties;

  useLayoutEffect(() => {
    if (wide) {
      navigationOpenRef.current = false;
      navigationFocusTarget.current = undefined;
      setNavigationOpen(false);
    }
  }, [wide]);

  return (
    <AppNavigationContext.Provider value={navigationContext}>
      <AppFloatingProvider supported={wide}>
        <DesignMetadataBoundary excludeComponents={['AppBackground', 'WorkspaceSurface']}>
          <AppBackground
            brandPrimary={brandPrimary}
            ref={shellRef}
            className={cn(
              'relative flex h-screen w-full flex-row items-start justify-center gap-[var(--app-shell-gap)] overflow-hidden',
              className,
            )}
            style={geometryStyle}
            {...props}
            {...capture}
          >
            <Drawer
              open={navigationOpen}
              onOpenChange={(open) => {
                navigationOpenRef.current = open;
                if (open) {
                  navigationFocusTarget.current = undefined;
                  navigationOpener.current =
                    document.activeElement instanceof HTMLElement ? document.activeElement : null;
                }
                setNavigationOpen(open);
              }}
            >
              {wide ? (
                <aside
                  key="persistent-navigation"
                  className="flex h-full w-[var(--app-navigation-width)] shrink-0 flex-col pt-2"
                  data-app-shell-region="navigation"
                  {...designSlot('AppShell', 'navigation')}
                >
                  {navigation}
                </aside>
              ) : null}

              <AppWorkspaceContext.Provider key="workspace" value={workspaceContext}>
                {workspaceMaterialOwner === 'shell' ? (
                  <WorkspaceSurface
                    as="main"
                    className={cn(
                      'mt-4 h-[calc(100%-1rem)] w-max has-[[data-workspace-fit=available]]:w-full min-w-0 max-w-[calc(100%-var(--app-navigation-width)-var(--app-shell-gap))] flex-none overflow-hidden rounded-tl-surface border-t border-l border-workspace-edge',
                      workspaceIsInset && 'rounded-tr-surface border-r',
                    )}
                    data-app-shell-region="workspace"
                    data-app-shell-workspace-fit={workspaceIsInset ? 'inset' : 'edge'}
                    {...designSlot('AppShell', 'workspace')}
                  >
                    {children}
                  </WorkspaceSurface>
                ) : (
                  <main
                    className="h-full w-full min-w-0 flex-none overflow-hidden"
                    data-app-shell-region="workspace"
                    data-app-shell-workspace-material-owner="panel"
                    {...designSlot('AppShell', 'workspace')}
                  >
                    {children}
                  </main>
                )}
              </AppWorkspaceContext.Provider>

              {!wide ? (
                <DrawerContent
                  key="drawer-navigation"
                  className="max-w-[min(20rem,85vw)]"
                  closeLabel={labels.closeNavigation}
                  side="left"
                  onCloseAutoFocus={(event) => {
                    const target = navigationFocusTarget.current?.() ?? navigationOpener.current;
                    navigationFocusTarget.current = undefined;
                    if (target) {
                      event.preventDefault();
                      target.focus();
                    }
                  }}
                >
                  <DrawerTitle className="sr-only">{labels.navigationTitle}</DrawerTitle>
                  {navigation}
                </DrawerContent>
              ) : null}
            </Drawer>

            <AppFloatingOutlet />
          </AppBackground>
        </DesignMetadataBoundary>
      </AppFloatingProvider>
    </AppNavigationContext.Provider>
  );
}
