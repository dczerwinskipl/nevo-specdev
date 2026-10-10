import { forwardRef, type LiHTMLAttributes } from 'react';
import { fastColorTransitionClassName } from '../../../design-system/interactionRecipes';
import { cn } from '../../../lib';

export interface InformationListItemProps extends LiHTMLAttributes<HTMLLIElement> {
  readonly interactive?: boolean;
  readonly selected?: boolean;
}

export const InformationListItem = forwardRef<HTMLLIElement, InformationListItemProps>(
  function InformationListItem(
    { className, children, interactive = false, selected = false, ...props },
    ref,
  ) {
    return (
      <li
        ref={ref}
        className={cn(
          '@container/info-row group relative flex min-h-14 min-w-0 items-center rounded-control px-2 py-2',
          fastColorTransitionClassName,
          interactive && 'hover:bg-surface-hover',
          selected && 'bg-surface-selected/40',
          className,
        )}
        {...props}
      >
        <div className="flex w-full min-w-0 items-center gap-x-3">{children}</div>
      </li>
    );
  },
);
