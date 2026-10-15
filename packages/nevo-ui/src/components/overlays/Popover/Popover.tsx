import * as PopoverPrimitive from '@radix-ui/react-popover';
import { forwardRef, type ComponentPropsWithoutRef, type ComponentRef } from 'react';
import { designSlot, useDesignMetadata } from '@nevo/figma-capture/metadata';
import { floatingSurfaceClassName } from '../../../design-system/floatingRecipes';
import { cn } from '../../../lib';

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;

export type PopoverContentProps = ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & {
  container?: HTMLElement | null;
  motion?: 'default' | 'navigation';
};

export const PopoverContent = forwardRef<
  ComponentRef<typeof PopoverPrimitive.Content>,
  PopoverContentProps
>(function PopoverContent(
  { align = 'start', children, className, container, motion = 'default', sideOffset = 8, ...props },
  ref,
) {
  const capture = useDesignMetadata('Popover');

  return (
    <PopoverPrimitive.Portal container={container}>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        className={cn('popover-content', floatingSurfaceClassName, className)}
        sideOffset={sideOffset}
        data-motion={motion}
        {...props}
        {...capture}
      >
        <div {...designSlot('Popover', 'content')}>{children}</div>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
});
