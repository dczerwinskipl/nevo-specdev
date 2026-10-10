import { forwardRef, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { IconButton, type IconButtonSize } from '../../actions/IconButton';
import { cn } from '../../../lib';
import { Menu, MenuContent, MenuLabel, MenuTrigger } from './Menu';

export interface OverflowMenuProps {
  /** Context displayed in the expanded surface, not a generic action heading. */
  label: string;
  triggerLabel: string;
  children: ReactNode;
  /** Applied to the ellipsis trigger; its layout footprint remains stable while open. */
  className?: string;
  size?: IconButtonSize;
  disabled?: boolean;
  title?: string;
}

/** An overflow menu that expands over its trigger rather than floating below it. */
export const OverflowMenu = forwardRef<HTMLButtonElement, OverflowMenuProps>(function OverflowMenu(
  { children, className, label, size = 'md', triggerLabel, disabled, title },
  ref,
) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ width: 36, height: 36 });

  return (
    <Menu
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen && triggerRef.current) {
          const { width, height } = triggerRef.current.getBoundingClientRect();
          setAnchor({ width, height });
        }
        setOpen(nextOpen);
      }}
    >
      <MenuTrigger asChild>
        <IconButton
          ref={(node) => {
            triggerRef.current = node;
            if (typeof ref === 'function') return ref(node);
            if (ref) ref.current = node;
          }}
          aria-label={triggerLabel}
          className={cn('data-[state=open]:opacity-0', className)}
          disabled={disabled}
          title={title}
          icon="ellipsis"
          size={size}
          variant="ghost"
        />
      </MenuTrigger>
      <MenuContent
        align="end"
        aria-label={triggerLabel}
        className="overflow-menu-content w-auto max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto"
        sideOffset={-anchor.height}
        style={
          {
            '--overflow-menu-anchor-width': `${anchor.width}px`,
            '--overflow-menu-anchor-height': `${anchor.height}px`,
          } as CSSProperties
        }
      >
        <MenuLabel title={label} data-overflow-menu-label>
          {label}
        </MenuLabel>
        {children}
      </MenuContent>
    </Menu>
  );
});
