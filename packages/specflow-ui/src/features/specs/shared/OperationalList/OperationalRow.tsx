import { Icon, InformationList, Typography, cn, useOptionalInformationListContext } from '@nevo/ui';
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
  'pointer-events-auto static cursor-pointer whitespace-normal [overflow-wrap:anywhere] @min-[40rem]/info-row:truncate outline-none after:absolute after:inset-0 after:rounded-control focus-visible:after:outline-2 focus-visible:after:outline-focus-ring hover:text-accent-primary';
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
  const list = useOptionalInformationListContext();
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
      className="pointer-events-auto static block w-full whitespace-normal [overflow-wrap:anywhere] @min-[40rem]/info-row:truncate text-left cursor-pointer outline-none after:absolute after:inset-0 after:rounded-control focus-visible:after:outline-2 focus-visible:after:outline-focus-ring hover:text-accent-primary"
      aria-label={primaryAriaLabel}
      onClick={onPrimaryClick}
    >
      {primary}
    </button>
  ) : (
    <span className="min-w-0 [overflow-wrap:anywhere] @min-[40rem]/info-row:truncate">
      {primary}
    </span>
  );
  const primaryContent = primaryLink ?? fallbackPrimary;
  let supportingContent: React.ReactNode = null;
  if (supporting) {
    if (isSemanticSupporting(supporting)) {
      supportingContent = (
        <span
          className={cn(
            'inline-flex min-w-0 items-start gap-1.5 [overflow-wrap:anywhere] text-content-secondary',
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
          <span className="min-w-0">{supporting.text}</span>
        </span>
      );
    } else {
      supportingContent = (
        <div className="[overflow-wrap:anywhere] text-content-secondary">{supporting}</div>
      );
    }
  }
  const facts = compactFacts;
  const populatedFacts = facts.filter(
    (fact) => (typeof fact === 'string' ? fact : fact.text).length > 0,
  );
  const secondaryGridClass =
    facts.length === 0
      ? 'min-w-0'
      : facts.length === 2
        ? 'grid min-w-0 grid-cols-1 gap-y-0.5 @min-[40rem]/info-row:grid-cols-[calc(var(--spacing)*18)_calc(var(--spacing)*24)_minmax(0,1fr)] @min-[40rem]/info-row:items-baseline @min-[40rem]/info-row:gap-x-2'
        : 'grid min-w-0 grid-cols-1 gap-y-0.5 @min-[40rem]/info-row:grid-cols-[calc(var(--spacing)*18)_minmax(0,1fr)] @min-[40rem]/info-row:items-baseline @min-[40rem]/info-row:gap-x-2';
  const renderFact = (fact: (typeof compactFacts)[number] | undefined) => {
    if (fact === undefined) return null;
    const text = typeof fact === 'string' ? fact : fact.text;
    const isMono = typeof fact === 'object' && fact.mono;
    const attrs = typeof fact === 'object' ? fact.dataAttributes : undefined;
    return (
      <span
        className={cn('min-w-0 text-content-muted [overflow-wrap:anywhere]', isMono && 'font-mono')}
        {...attrs}
      >
        {text}
      </span>
    );
  };
  const leadingSlot =
    (leading != null && leading !== false) || list?.selectable ? (
      <InformationList.Leading>{leading}</InformationList.Leading>
    ) : null;
  return (
    <InformationList.Item
      interactive={isRowInteractive}
      selected={selected}
      className={className}
      {...dataAttributes}
    >
      {leadingSlot}
      <InformationList.Content>
        <div
          className={cn(
            'pointer-events-none grid min-w-0 gap-x-4 gap-y-1',
            metadata &&
              '@3xl/info-row:grid-cols-[minmax(0,1fr)_fit-content(18rem)] @3xl/info-row:items-center',
          )}
        >
          <div className="min-w-0 flex-1">
            {/* Primary title follows the available row width. */}
            <Typography
              as={titleAs}
              variant="title-sm"
              className="flex min-w-0 text-content-primary"
              data-spec-title="true"
            >
              {primaryContent}
            </Typography>
            {/* Line 2: Compact facts + supporting */}
            {populatedFacts.length > 0 || supportingContent ? (
              <Typography
                as="div"
                variant="body-sm"
                className={cn(secondaryGridClass, 'text-content-muted')}
                data-spec-secondary="true"
              >
                {facts.length > 0 ? (
                  <div
                    className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 @min-[40rem]/info-row:contents"
                    data-compact-facts
                  >
                    {facts.map((fact, index) => (
                      <div
                        key={index}
                        className={cn(
                          'flex min-w-0 max-w-full items-baseline gap-1.5 @min-[40rem]/info-row:contents',
                          !(typeof fact === 'string' ? fact : fact.text) && 'hidden',
                        )}
                      >
                        {facts
                          .slice(0, index)
                          .some(
                            (previous) =>
                              (typeof previous === 'string' ? previous : previous.text).length > 0,
                          ) ? (
                          <span aria-hidden="true" className="@min-[40rem]/info-row:hidden">
                            ·
                          </span>
                        ) : null}
                        {renderFact(fact)}
                      </div>
                    ))}
                  </div>
                ) : null}
                {supportingContent && (
                  <div className="min-w-0 [overflow-wrap:anywhere]">{supportingContent}</div>
                )}
              </Typography>
            ) : null}
          </div>
          {metadata ? (
            <div
              className="flex min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-content-secondary [overflow-wrap:anywhere]"
              data-spec-metadata="true"
            >
              {metadata}
            </div>
          ) : null}
        </div>
      </InformationList.Content>
      {trailing ? <InformationList.Trailing>{trailing}</InformationList.Trailing> : null}
    </InformationList.Item>
  );
}
