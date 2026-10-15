import { forwardRef, type AnchorHTMLAttributes } from 'react';
import { createLink } from '@tanstack/react-router';
import { cn } from '@nevo/ui';
/** Breadcrumbs own current-page semantics; ancestors still use canonical router links. */
export const LocationLink = createLink(
  forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement>>(function AncestorLink(
    { className, ...props },
    ref,
  ) {
    return (
      <a
        {...props}
        ref={ref}
        className={cn(
          'outline-none focus-visible:outline-2 focus-visible:outline-focus-ring',
          className,
        )}
        aria-current={undefined}
      />
    );
  }),
);
