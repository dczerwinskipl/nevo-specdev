import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../../../lib';

export type InformationListContentProps = HTMLAttributes<HTMLDivElement>;

export const InformationListContent = forwardRef<HTMLDivElement, InformationListContentProps>(
  function InformationListContent({ className, children, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn('pointer-events-none flex min-w-0 flex-1 flex-col gap-y-1', className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);
