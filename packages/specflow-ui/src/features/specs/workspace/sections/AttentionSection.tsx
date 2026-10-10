import { Button, Icon, Typography } from '@nevo/ui';
import type { SpecificationAttentionEntry } from '../../extensions/specificationAttentionItems';
import { useTranslation } from 'react-i18next';

export interface AttentionSectionProps {
  readonly items: readonly (SpecificationAttentionEntry & { readonly renderKey: string })[];
}

export function AttentionSection({ items }: AttentionSectionProps) {
  const { t } = useTranslation();

  if (items.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="attention-heading"
      className="rounded-control border border-border-subtle bg-surface-subtle p-4"
    >
      <div className="flex items-center gap-2">
        <span className="flex size-4 shrink-0 items-center justify-center text-content-muted">
          <Icon name="clock" size="sm" />
        </span>
        <Typography
          as="h3"
          variant="section-label"
          id="attention-heading"
          className="font-semibold text-content-primary"
        >
          {t('specification.requiresAttention')}{' '}
          <span className="text-body-xs font-normal normal-case tracking-normal text-content-muted">
            {items.length}
          </span>
        </Typography>
      </div>

      <div className="mt-3 divide-y divide-border-subtle">
        {items.map(({ item, icon, action, renderKey }) => {
          return (
            <div
              key={renderKey}
              className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="flex size-4 shrink-0 items-center justify-center text-content-secondary mt-1">
                  <Icon name={icon} size="sm" />
                </span>
                <div className="min-w-0 flex-1">
                  <Typography
                    as="span"
                    variant="title-sm"
                    className="block min-w-0 font-medium text-content-primary [overflow-wrap:anywhere]"
                  >
                    {item.title}
                  </Typography>
                  <Typography
                    as="div"
                    variant="body-sm"
                    className="mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-2 text-content-secondary"
                  >
                    <span>{item.reason}</span>
                  </Typography>
                </div>
              </div>

              {action ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="self-start sm:self-center shrink-0"
                  disabled={action.disabled}
                  title={action.disabledTitleKey ? t(action.disabledTitleKey) : undefined}
                  onClick={action.onClick}
                >
                  {action.labelKey ? t(action.labelKey) : action.label}
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
