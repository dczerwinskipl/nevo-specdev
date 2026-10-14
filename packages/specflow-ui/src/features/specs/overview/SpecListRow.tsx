import {
  InformationList,
  Link,
  MenuItem,
  MenuSeparator,
  OverflowMenu,
  Progress,
  Typography,
  cn,
} from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import type { SpecRowModel } from './presentation';
import type { CurrentSpecTarget } from './model';
import { SpecRowSummary } from './SpecRowSummary';

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

export const specPrimaryLinkClassName =
  'pointer-events-auto static cursor-pointer whitespace-normal [overflow-wrap:anywhere] outline-none after:absolute after:inset-0 after:rounded-control focus-visible:after:outline-2 focus-visible:after:outline-focus-ring hover:text-accent-primary';

export function SpecListRow({
  item,
  specificationHref,
  onOpenTarget,
  renderSpecificationLink,
}: SpecListRowProps) {
  const { t } = useTranslation();
  const target: CurrentSpecTarget = { kind: 'specification', specId: item.id };
  const label = t('specifications.openSpec', { title: item.title });
  const pr = item.pullRequests;
  const pullRequests =
    pr?.kind === 'single' ? (
      <Link
        className="pointer-events-auto relative z-10 inline-flex min-h-6 items-center rounded-control-inline"
        href={pr.href}
        aria-label={t('specifications.openPullRequest', { number: pr.number, title: item.title })}
      >
        PR #{pr.number}
      </Link>
    ) : pr?.kind === 'multiple' ? (
      <span>{t('specifications.pullRequests', { count: pr.count })}</span>
    ) : null;
  const primary =
    renderSpecificationLink?.(item.id, item.title, label) ??
    (specificationHref ? (
      <a
        href={specificationHref}
        className={specPrimaryLinkClassName}
        data-focus-ring="delegated"
        aria-label={label}
        onClick={(event) => {
          if (
            !onOpenTarget ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          event.preventDefault();
          onOpenTarget(target);
        }}
      >
        {item.title}
      </a>
    ) : onOpenTarget ? (
      <button
        type="button"
        className={`${specPrimaryLinkClassName} text-left`}
        data-focus-ring="delegated"
        aria-label={label}
        onClick={() => onOpenTarget(target)}
      >
        {item.title}
      </button>
    ) : (
      item.title
    ));
  const facts: ReactNode[] = [
    ...(item.key
      ? [
          <span key="key" className="font-mono" data-spec-key>
            {item.key}
          </span>,
        ]
      : []),
    ...item.tags.map((tag) => <span key={`tag-${tag}`}>{tag}</span>),
    ...(item.omittedTags ? [<span key="more">+{item.omittedTags}</span>] : []),
    ...(item.collection === 'current' && pullRequests
      ? [<span key="pr">{pullRequests}</span>]
      : []),
  ];
  const count = t('specifications.progress', item.progress);
  const valid =
    Number.isSafeInteger(item.progress.total) &&
    item.progress.total >= 0 &&
    Number.isSafeInteger(item.progress.completed) &&
    item.progress.completed >= 0 &&
    item.progress.completed <= item.progress.total;
  return (
    <InformationList.Item
      interactive={
        Boolean(specificationHref) || Boolean(onOpenTarget) || Boolean(renderSpecificationLink)
      }
      className="py-3"
      data-spec-id={item.id}
      data-spec-key={item.key}
    >
      <InformationList.Content>
        <div
          className={
            item.collection === 'current'
              ? 'grid min-w-0 gap-x-6 gap-y-2 @min-[48rem]/collection:grid-cols-[minmax(0,1fr)_15rem_7rem]'
              : 'grid min-w-0 gap-x-6 gap-y-2 @min-[48rem]/collection:grid-cols-[minmax(0,1fr)_12rem_6rem]'
          }
        >
          <div className="min-w-0">
            <Typography
              as={item.collection === 'current' ? 'h3' : 'h2'}
              variant="title-sm"
              className="min-w-0 text-content-primary"
              data-spec-title
            >
              {primary}
            </Typography>
            {facts.length ? (
              <Typography
                as="div"
                variant="body-sm"
                className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 text-content-secondary [overflow-wrap:anywhere]"
                data-spec-metadata
              >
                {facts.map((fact, index) => (
                  <span key={index} className="contents">
                    {index ? <span aria-hidden="true">·</span> : null}
                    {fact}
                  </span>
                ))}
              </Typography>
            ) : null}
          </div>
          {item.collection === 'current' ? (
            <>
              <Typography
                as="div"
                variant="body-sm"
                className="flex min-w-0 items-center gap-2 text-content-secondary @min-[48rem]/collection:col-start-3 @min-[48rem]/collection:row-start-1 @min-[48rem]/collection:flex-col @min-[48rem]/collection:items-start"
                data-spec-progress
              >
                {!valid ? (
                  t('specifications.invalidProgress')
                ) : item.progress.total === 0 ? (
                  t('specifications.noTasks')
                ) : (
                  <>
                    <div className="w-28 shrink-0">
                      <Progress
                        variant="segmented"
                        size="compact"
                        completed={item.progress.completed}
                        total={item.progress.total}
                        aria-label={t('specifications.progressLabel', { title: item.title })}
                        aria-valuetext={count}
                      />
                    </div>
                    <span>{count}</span>
                  </>
                )}
              </Typography>
              <Typography
                as="div"
                variant="body-sm"
                className="min-w-0 @min-[48rem]/collection:col-start-2 @min-[48rem]/collection:row-start-1"
                data-spec-summary
              >
                <SpecRowSummary item={item} />
              </Typography>
            </>
          ) : (
            <>
              <Typography
                as="div"
                variant="body-sm"
                className="min-w-0 text-content-secondary"
                data-spec-summary
              >
                <SpecRowSummary item={item} />
              </Typography>
              <Typography
                as="div"
                variant="body-sm"
                className={cn(
                  'min-w-0 text-content-secondary',
                  !pullRequests && 'hidden @min-[48rem]/collection:block',
                )}
              >
                {pullRequests}
              </Typography>
            </>
          )}
        </div>
      </InformationList.Content>
      <InformationList.Trailing>
        <OverflowMenu
          className="min-h-11 min-w-11 @min-[48rem]/collection:min-h-control-height-default @min-[48rem]/collection:min-w-control-height-default"
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
      </InformationList.Trailing>
    </InformationList.Item>
  );
}
