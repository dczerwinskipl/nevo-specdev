import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../../../lib';

export type InformationListTrailingProps = HTMLAttributes<HTMLDivElement>;

export const InformationListTrailing = forwardRef<HTMLDivElement, InformationListTrailingProps>(
  function InformationListTrailing({ className, children, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn('relative z-10 shrink-0 self-start sm:self-center', className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);
