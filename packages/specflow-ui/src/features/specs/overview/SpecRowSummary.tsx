import { Icon } from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import type { SpecRowModel } from './presentation';

export function SpecRowSummary({ item }: { readonly item: SpecRowModel }) {
  const { t, i18n } = useTranslation();
  if (item.collection === 'archive') {
    const history = item.history;
    const validDate = history.timestamp && Number.isFinite(Date.parse(history.timestamp));
    const date = validDate
      ? new Intl.DateTimeFormat(i18n.resolvedLanguage, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        }).format(new Date(history.timestamp!))
      : undefined;
    return (
      <span className="flex flex-wrap gap-x-1 @min-[48rem]/collection:flex-col">
        <span className="@min-[48rem]/collection:order-2">
          {t(`specifications.milestone.${history.kind}`)}
        </span>
        <span aria-hidden="true" className="@min-[48rem]/collection:hidden">
          ·
        </span>
        {validDate ? (
          <time dateTime={history.timestamp}>{date}</time>
        ) : (
          <span>{t('specifications.dateUnavailable')}</span>
        )}
      </span>
    );
  }
  const summary = item.summary;
  const text =
    summary.kind === 'attention'
      ? t(
          summary.reason
            ? `specifications.summary.${summary.reason}`
            : 'specifications.sections.requiresAttention',
          {
            count: summary.reason === 'review' ? 1 : (summary.count ?? 1),
          },
        )
      : summary.kind === 'active'
        ? t('specifications.summary.active', { count: summary.executionCount })
        : t(`specifications.summary.${summary.kind}`);
  return (
    <span
      className={
        summary.kind === 'attention'
          ? 'text-status-attention [overflow-wrap:anywhere]'
          : 'text-content-secondary [overflow-wrap:anywhere]'
      }
      data-spec-reason
    >
      {summary.kind === 'attention' ? (
        <Icon
          name={
            summary.reason === 'blocked'
              ? 'triangle-alert'
              : summary.reason === 'review'
                ? 'file-search'
                : 'chat'
          }
          size="sm"
          className="mr-1 inline-block align-text-bottom"
        />
      ) : null}
      <span>{text}</span>
      {item.qualifier ? (
        <span className="block text-content-secondary">
          {t('specifications.summary.concurrent', { count: item.qualifier.executionCount })}
        </span>
      ) : null}
    </span>
  );
}
