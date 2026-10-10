import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../../../lib';

export type InformationListLeadingProps = HTMLAttributes<HTMLDivElement>;

export const InformationListLeading = forwardRef<HTMLDivElement, InformationListLeadingProps>(
  function InformationListLeading({ className, children, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          'relative z-10 flex h-control-height-default w-control-height-compact shrink-0 items-center justify-center self-start sm:self-center',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
