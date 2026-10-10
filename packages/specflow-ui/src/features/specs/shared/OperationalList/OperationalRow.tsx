import { Icon, InformationList, Typography, cn } from '@nevo/ui';
import type { OperationalRowProps, SemanticSupporting } from './OperationalRow.types';

function isSemanticSupporting(value: unknown): value is SemanticSupporting {
  return (
    typeof value === 'object' &&
    value !== null &&
    'text' in value &&
    typeof (value as SemanticSupporting).text === 'string'
  );
}

export const operationalPrimaryLinkClassName =
  'pointer-events-auto static cursor-pointer truncate outline-none after:absolute after:inset-0 after:rounded-control focus-visible:after:outline-2 focus-visible:after:outline-focus-ring hover:text-accent-primary';

export function OperationalRow({
  primary,
  primaryHref,
  primaryLink,
  onPrimaryClick,
  primaryAriaLabel,
  compactFacts = [],
  supporting,
  metadata,
  trailing,
  leading,
  interactive = false,
  selected = false,
  titleAs = 'span',
  className,
  dataAttributes = {},
}: OperationalRowProps) {
  const isRowInteractive =
    interactive || Boolean(primaryLink) || Boolean(primaryHref) || Boolean(onPrimaryClick);

  const fallbackPrimary = primaryHref ? (
    <a
      href={primaryHref}
      data-focus-ring="delegated"
      className={operationalPrimaryLinkClassName}
      aria-label={primaryAriaLabel}
      onClick={onPrimaryClick}
    >
      {primary}
    </a>
  ) : onPrimaryClick ? (
    <button
      type="button"
      data-focus-ring="delegated"
      className="pointer-events-auto static block w-full truncate text-left cursor-pointer outline-none after:absolute after:inset-0 after:rounded-control focus-visible:after:outline-2 focus-visible:after:outline-focus-ring hover:text-accent-primary"
      aria-label={primaryAriaLabel}
      onClick={onPrimaryClick}
    >
      {primary}
    </button>
  ) : (
    <span className="truncate">{primary}</span>
  );

  const primaryContent = primaryLink ?? fallbackPrimary;

  let supportingContent: React.ReactNode = null;
  if (supporting) {
    if (isSemanticSupporting(supporting)) {
      supportingContent = (
        <span
          className={cn(
            'inline-flex min-w-0 items-center gap-1.5 truncate text-content-secondary',
            supporting.tone === 'attention' && 'text-status-attention font-medium',
            supporting.tone === 'danger' && 'text-status-danger font-medium',
            supporting.tone === 'success' && 'text-status-success',
            supporting.tone === 'info' && 'text-accent-primary font-medium',
            supporting.textClassName,
          )}
        >
          {supporting.icon && (
            <span className="flex size-4 shrink-0 items-center justify-center">
              <Icon
                name={supporting.icon}
                size="sm"
                className={cn('shrink-0', supporting.iconClassName)}
              />
            </span>
          )}
          <span className="truncate">{supporting.text}</span>
        </span>
      );
    } else {
      supportingContent = <span className="truncate text-content-secondary">{supporting}</span>;
    }
  }

  // Schema fact layout:
  // 1 compact fact: [calc(var(--spacing)*18)_minmax(0,1fr)]
  // 2 compact facts: [calc(var(--spacing)*18)_calc(var(--spacing)*24)_minmax(0,1fr)]
  const fact1 = compactFacts[0];
  const fact2 = compactFacts[1];
  const hasTwoFacts = compactFacts.length === 2;

  const secondaryGridClass = hasTwoFacts
    ? 'grid min-w-0 grid-cols-1 gap-y-0.5 sm:grid-cols-[calc(var(--spacing)*18)_calc(var(--spacing)*24)_minmax(0,1fr)] sm:items-baseline sm:gap-x-2'
    : 'grid min-w-0 grid-cols-1 gap-y-0.5 sm:grid-cols-[calc(var(--spacing)*18)_minmax(0,1fr)] sm:items-baseline sm:gap-x-2';

  const renderFact = (fact: (typeof compactFacts)[number] | undefined) => {
    if (fact === undefined) return null;
    const text = typeof fact === 'string' ? fact : fact.text;
    const isMono = typeof fact === 'object' && fact.mono;
    const attrs = typeof fact === 'object' ? fact.dataAttributes : undefined;
    return (
      <span className={cn('truncate text-content-secondary', isMono && 'font-mono')} {...attrs}>
        {text}
      </span>
    );
  };

  const leadingSlot = leading ? <InformationList.Leading>{leading}</InformationList.Leading> : null;

  return (
    <InformationList.Item
      interactive={isRowInteractive}
      selected={selected}
      className={className}
      {...dataAttributes}
    >
      {leadingSlot}

      <InformationList.Content>
        <div className="pointer-events-none flex min-w-0 flex-1 flex-col gap-x-4 gap-y-1 @3xl/info-row:flex-row @3xl/info-row:items-center">
          <div className="min-w-0 flex-1">
            {/* Line 1: Primary title single line */}
            <Typography
              as={titleAs}
              variant="title-sm"
              className="flex min-w-0 text-content-primary"
              data-spec-title="true"
            >
              {primaryContent}
            </Typography>

            {/* Line 2: Compact facts + supporting */}
            {compactFacts.length > 0 || supportingContent ? (
              <Typography
                as="div"
                variant="body-sm"
                className={cn(secondaryGridClass, 'text-content-muted')}
                data-spec-secondary="true"
              >
                {renderFact(fact1)}

                {renderFact(fact2)}
                {supportingContent && <div className="min-w-0 truncate">{supportingContent}</div>}
              </Typography>
            ) : null}
          </div>

          {metadata ? (
            <div className="flex min-w-0 max-w-full shrink-0 flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-content-secondary">
              {metadata}
            </div>
          ) : null}
        </div>
      </InformationList.Content>

      {trailing ? <InformationList.Trailing>{trailing}</InformationList.Trailing> : null}
    </InformationList.Item>
  );
}
