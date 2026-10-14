import {
  forwardRef,
  useId,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type LiHTMLAttributes,
} from 'react';
import { Icon, type IconGlyph } from '../../foundations/Icon';
import { cn } from '../../../lib';
import { designSlot, useDesignMetadata } from '@nevo/figma-capture/metadata';
import {
  sideNavigationRowClassName,
  sideNavigationContentClassName,
} from './sideNavigation.styles';

export interface NavigationRowProps extends Omit<LiHTMLAttributes<HTMLLIElement>, 'children'> {
  readonly label: ReactNode;
  readonly icon?: IconGlyph;
  readonly active?: boolean;
  readonly selectionTreatment?: 'marker' | 'surface';
  readonly renderLink: (children: ReactNode, className: string) => ReactNode;
  readonly trailing?: ReactNode;
  readonly disclosure?: {
    readonly expanded: boolean;
    readonly label: string;
    readonly onToggle: () => void;
    readonly content: ReactNode;
  };
}
/** Flat navigation with independent route and disclosure targets. */
export const NavigationRow = forwardRef<HTMLLIElement, NavigationRowProps>(function NavigationRow(
  {
    label,
    icon,
    active = false,
    selectionTreatment = 'marker',
    renderLink,
    trailing,
    disclosure,
    className,
    ...props
  },
  ref,
) {
  const id = useId();
  const capture = useDesignMetadata('NavigationRow', {
    state: active ? 'active' : 'none',
    selectionTreatment,
    disclosure: disclosure ? (disclosure.expanded ? 'expanded' : 'collapsed') : 'none',
  });
  const trigger = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const containedFocus = useRef(false);
  useLayoutEffect(() => {
    if (
      disclosure &&
      !disclosure.expanded &&
      (containedFocus.current || content.current?.contains(document.activeElement))
    ) {
      trigger.current?.focus();
      containedFocus.current = false;
    }
  }, [disclosure?.expanded]);
  return (
    <li ref={ref} className={cn('min-w-0 list-none', className)} {...props} {...capture}>
      <div
        className={cn(
          sideNavigationRowClassName(active ? 'active' : 'none'),
          'min-h-control-height-default [@media(pointer:coarse)]:min-h-11',
        )}
        data-navigation-state={active ? 'active' : 'none'}
        data-selection-treatment={selectionTreatment}
      >
        {active && selectionTreatment === 'marker' ? (
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-0.5 rounded-r bg-action-primary"
          />
        ) : null}
        {renderLink(
          <>
            {icon ? (
              <Icon name={icon} size="sm" className="shrink-0" />
            ) : (
              <span className="w-4 shrink-0" />
            )}
            <span
              className={cn(
                'min-w-0 flex-1 whitespace-normal text-body-md [overflow-wrap:anywhere]',
                active && 'font-semibold',
              )}
              {...designSlot('NavigationRow', 'label')}
            >
              {label}
            </span>
          </>,
          cn(
            sideNavigationContentClassName(),
            'self-stretch rounded-control focus-visible:outline-2 focus-visible:outline-focus-ring',
          ),
        )}
        {trailing ? (
          <span className="shrink-0 text-body-sm text-content-secondary">{trailing}</span>
        ) : null}
        {disclosure ? (
          <button
            ref={trigger}
            type="button"
            aria-label={disclosure.label}
            aria-controls={id}
            aria-expanded={disclosure.expanded}
            onClick={disclosure.onToggle}
            className="flex size-control-height-default shrink-0 items-center justify-center rounded-control outline-none focus-visible:outline-2 focus-visible:outline-focus-ring [@media(pointer:coarse)]:size-11"
          >
            <Icon
              name="chevron-down"
              size="sm"
              className="transition-transform duration-[210ms] motion-reduce:transition-none"
              style={{ transform: disclosure.expanded ? 'rotate(180deg)' : undefined }}
            />
          </button>
        ) : null}
      </div>
      {disclosure ? (
        <div
          ref={content}
          onFocusCapture={() => {
            containedFocus.current = true;
          }}
          onBlurCapture={() => {
            queueMicrotask(() => {
              if (!content.current?.contains(document.activeElement))
                containedFocus.current = false;
            });
          }}
          id={id}
          inert={!disclosure.expanded}
          aria-hidden={!disclosure.expanded}
          className="grid transition-[grid-template-rows,opacity] duration-[210ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{
            gridTemplateRows: disclosure.expanded ? '1fr' : '0fr',
            opacity: disclosure.expanded ? 1 : 0,
            transitionTimingFunction: 'cubic-bezier(0.22,1,0.36,1), ease-out',
          }}
        >
          <div className="min-h-0 overflow-hidden" {...designSlot('NavigationRow', 'preview')}>
            {disclosure.content}
          </div>
        </div>
      ) : null}
    </li>
  );
});
