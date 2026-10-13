import { createContext, useContext, type HTMLAttributes, type PropsWithChildren } from 'react';
import { tv } from 'tailwind-variants/lite';
import { cn } from '../../lib';
import { ScrollArea } from '../../components/layout/ScrollArea';

const appWorkspaceBodyVariants = tv({
  base: 'min-h-0 flex-1 overflow-y-auto',
  variants: {
    padding: {
      none: '',
      sm: 'p-3',
      md: 'p-4',
    },
  },
  defaultVariants: {
    padding: 'md',
  },
});

const AppContentScrollContext = createContext(false);

export function AppContentScrollProvider({ children }: PropsWithChildren) {
  return <AppContentScrollContext.Provider value>{children}</AppContentScrollContext.Provider>;
}

const appContentContainerVariants = tv({
  base: '@container min-w-0 max-w-full',
  variants: {
    align: {
      start: '',
      center: 'mx-auto',
      end: 'ml-auto',
    },
    size: {
      narrow: 'w-content-narrow',
      standard: 'w-content-standard',
      wide: 'w-content-wide',
      xwide: 'w-content-xwide',
      full: 'w-full',
    },
  },
  defaultVariants: {
    align: 'center',
    size: 'standard',
  },
});

export function AppContent({
  children,
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  const ancestorOwnsScroll = useContext(AppContentScrollContext);

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col',
        ancestorOwnsScroll ? 'min-h-full' : 'h-full',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function AppWorkspaceHeader({
  children,
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLElement>>) {
  return (
    <header
      className={cn(
        'flex h-14 shrink-0 items-center justify-between border-b border-border-subtle px-4',
        className,
      )}
      {...props}
    >
      {children}
    </header>
  );
}

export function AppWorkspaceBody({
  children,
  className,
  tabIndex = 0,
  padding = 'md',
  scroll = 'native',
  ...props
}: PropsWithChildren<
  HTMLAttributes<HTMLDivElement> & { padding?: 'none' | 'sm' | 'md'; scroll?: 'native' | 'area' }
>) {
  const ancestorOwnsScroll = useContext(AppContentScrollContext);

  if (scroll === 'area' && !ancestorOwnsScroll) {
    return (
      <ScrollArea
        {...props}
        className={cn('min-h-0 flex-1 w-full', className)}
        contentClassName={padding === 'md' ? 'p-4' : padding === 'sm' ? 'p-3' : undefined}
        tabIndex={tabIndex}
      >
        {children}
      </ScrollArea>
    );
  }

  return (
    <div
      className={cn(
        appWorkspaceBodyVariants({ padding }),
        ancestorOwnsScroll && 'min-h-auto flex-none overflow-visible',
        className,
      )}
      tabIndex={ancestorOwnsScroll ? undefined : tabIndex}
      {...props}
    >
      {children}
    </div>
  );
}

export type AppContentContainerSize = 'narrow' | 'standard' | 'wide' | 'xwide' | 'full';

export interface AppContentContainerProps extends HTMLAttributes<HTMLDivElement> {
  align?: 'start' | 'center' | 'end';
  size?: AppContentContainerSize;
}

export function AppContentContainer({
  align = 'center',
  children,
  className,
  size = 'standard',
  ...props
}: AppContentContainerProps) {
  return (
    <div className={cn(appContentContainerVariants({ align, size }), className)} {...props}>
      {children}
    </div>
  );
}
