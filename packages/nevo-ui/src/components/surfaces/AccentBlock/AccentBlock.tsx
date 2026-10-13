import { forwardRef, type HTMLAttributes } from 'react';
import { tv } from 'tailwind-variants/lite';
import { useDesignMetadata } from '@nevo/figma-capture/metadata';
import { cn } from '../../../lib';

export const accentBlockRecipe = tv({
  base: 'min-w-0 border-l-[3px] border-action-primary bg-surface-subtle p-4 text-content-primary [overflow-wrap:anywhere]',
});

/** Neutral grouping surface. The consumer owns heading and region semantics. */
export const AccentBlock = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function AccentBlock({ className, children, ...props }, ref) {
    const capture = useDesignMetadata('AccentBlock', {});
    return (
      <div ref={ref} className={cn(accentBlockRecipe(), className)} {...props} {...capture}>
        <div data-design-slot="content" className="min-w-0">
          {children}
        </div>
      </div>
    );
  },
);
