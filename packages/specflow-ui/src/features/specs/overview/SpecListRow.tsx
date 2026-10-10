import { Badge, Icon, Link, MenuItem, MenuSeparator, OverflowMenu } from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import type { SpecRowModel } from './presentation';
import type { CurrentSpecTarget } from './model';
import { SpecRowSummary } from './SpecRowSummary';
import { OperationalRow } from '../shared/OperationalList';
import type { ReactNode } from 'react';

export interface SpecListRowProps {
  readonly item: SpecRowModel;
  readonly specificationHref?: string;
  readonly onOpenTarget?: (target: CurrentSpecTarget) => void;
  readonly renderSpecificationLink?: (
    specId: string,
    children: ReactNode,
    ariaLabel: string,
  ) => ReactNode;
}

export function SpecListRow({
  item,
  specificationHref,
  onOpenTarget,
  renderSpecificationLink,
}: SpecListRowProps) {
  const { t } = useTranslation();
  const target: CurrentSpecTarget = { kind: 'specification', specId: item.id };
  const pr = item.pullRequests;

  const metadata =
    pr || item.tags.length > 0 ? (
      <div
        className="flex min-w-0 max-w-full shrink-0 flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-content-secondary"
        data-spec-metadata
      >
        {pr?.kind === 'single' ? (
          <Link
            className="pointer-events-auto relative z-10 inline-flex min-h-6 items-center rounded-control-inline"
            href={pr.href}
            aria-label={t('specifications.openPullRequest', {
              number: pr.number,
              title: item.title,
            })}
          >
            <span className="inline-flex items-center gap-1 underline decoration-current/50">
              <Icon name="branch" size="sm" />
              PR #{pr.number}
            </span>
          </Link>
        ) : pr?.kind === 'multiple' ? (
          <span className="inline-flex min-h-6 items-center">
            {t('specifications.pullRequests', { count: pr.count })}
          </span>
        ) : null}
        {item.tags.map((tag) => (
          <Badge className="min-h-6 max-w-32 [&>span]:truncate" title={tag} key={tag}>
            {tag}
          </Badge>
        ))}
        {item.omittedTags ? (
          <span className="inline-flex min-h-6 items-center">+{item.omittedTags}</span>
        ) : null}
      </div>
    ) : undefined;

  const trailing = (
    <OverflowMenu
      label={item.key ?? item.title}
      triggerLabel={t('specifications.rowActions', { title: item.title })}
    >
      <MenuItem
        leadingIcon="file"
        disabled={!onOpenTarget && !specificationHref}
        onSelect={() => {
          if (onOpenTarget) onOpenTarget(target);
          else if (specificationHref) window.location.assign(specificationHref);
        }}
      >
        {t('specifications.openDetails')}
      </MenuItem>
      <MenuSeparator />
      <MenuItem disabled leadingIcon="archive">
        {t('specifications.archiveUnavailable')}
      </MenuItem>
      <MenuItem disabled leadingIcon="trash" tone="danger">
        {t('specifications.deleteUnavailable')}
      </MenuItem>
    </OverflowMenu>
  );

  return (
    <OperationalRow
      primary={item.title}
      primaryLink={renderSpecificationLink?.(
        item.id,
        item.title,
        t('specifications.openSpec', { title: item.title }),
      )}
      primaryHref={renderSpecificationLink ? undefined : specificationHref}
      onPrimaryClick={
        !renderSpecificationLink && onOpenTarget
          ? (event) => {
              if (specificationHref) {
                if (
                  event.button !== 0 ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                ) {
                  return;
                }
                event.preventDefault();
              }
              onOpenTarget(target);
            }
          : undefined
      }
      primaryAriaLabel={t('specifications.openSpec', { title: item.title })}
      compactFacts={[
        { text: item.key ?? '', mono: true, dataAttributes: { 'data-spec-key': 'true' } },
        {
          text: t('specifications.progress', item.progress),
          dataAttributes: { 'data-spec-progress': 'true' },
        },
      ]}
      supporting={
        <div className="min-w-0" data-spec-summary>
          <SpecRowSummary item={item} />
        </div>
      }
      metadata={metadata}
      trailing={trailing}
      titleAs={item.collection === 'archive' ? 'h2' : 'h3'}
      dataAttributes={{
        'data-spec-id': item.id,
        'data-spec-key': item.key,
      }}
    />
  );
}
