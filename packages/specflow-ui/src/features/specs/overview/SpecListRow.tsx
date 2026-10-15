import {
  Badge,
  cn,
  fastColorTransitionClassName,
  Icon,
  Link,
  MenuItem,
  MenuSeparator,
  OverflowMenu,
  Typography,
} from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import type { SpecRowModel } from './presentation';
import type { CurrentSpecTarget } from './model';
import { scanGrid } from './geometry';
import { SpecRowSummary } from './SpecRowSummary';

export interface SpecListRowProps {
  readonly item: SpecRowModel;
  readonly specificationHref?: string;
  readonly onOpenTarget?: (target: CurrentSpecTarget) => void;
}

export function SpecListRow({ item, specificationHref, onOpenTarget }: SpecListRowProps) {
  const { t } = useTranslation();
  const target: CurrentSpecTarget = { kind: 'specification', specId: item.id };
  const pr = item.pullRequests;
  return (
    <li
      className={cn(
        '@container/spec-row group relative min-h-14 min-w-0 rounded-control py-2',
        specificationHref && 'hover:bg-surface-hover',
        fastColorTransitionClassName,
      )}
      data-spec-id={item.id}
    >
      <div className={cn(scanGrid, 'w-full max-w-content-standard items-center')} data-spec-rail>
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <div className="pointer-events-none flex min-w-0 flex-col gap-x-4 gap-y-1 pr-2 @3xl/spec-row:flex-row @3xl/spec-row:items-center">
          <div className="min-w-0 flex-1">
            <Typography
              as={item.collection === 'archive' ? 'h2' : 'h3'}
              variant="title-sm"
              className="min-w-0 text-content-primary [overflow-wrap:anywhere]"
              data-spec-title
            >
              {specificationHref ? (
                <a
                  href={specificationHref}
                  data-focus-ring="delegated"
                  className="pointer-events-auto static cursor-pointer outline-none after:absolute after:inset-0 after:rounded-control focus-visible:after:outline-2 focus-visible:after:outline-focus-ring"
                  aria-label={t('specifications.openSpec', { title: item.title })}
                  onClick={(event) => {
                    if (
                      onOpenTarget &&
                      event.button === 0 &&
                      !event.metaKey &&
                      !event.ctrlKey &&
                      !event.shiftKey &&
                      !event.altKey
                    ) {
                      event.preventDefault();
                      onOpenTarget(target);
                    }
                  }}
                >
                  {item.title}
                </a>
              ) : (
                item.title
              )}
            </Typography>
            <Typography
              as="div"
              variant="body-sm"
              className="grid min-w-0 grid-cols-[calc(var(--spacing)*18)_minmax(0,1fr)] items-baseline gap-x-2 text-content-muted @xl/spec-row:grid-cols-[calc(var(--spacing)*18)_calc(var(--spacing)*18)_minmax(0,1fr)]"
              data-spec-secondary
            >
              <span className="min-w-0 [overflow-wrap:anywhere]" data-spec-key>
                {item.key}
              </span>
              <span data-spec-progress>
                {item.progress
                  ? t('specifications.progress', item.progress)
                  : t('specifications.progressUnknown')}
              </span>
              <div className="col-span-2 min-w-0 @xl/spec-row:col-span-1" data-spec-summary>
                <SpecRowSummary item={item} />
              </div>
            </Typography>
          </div>
          {pr || item.tags.length ? (
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
          ) : null}
        </div>
        <div className="relative z-10 self-center">
          <OverflowMenu
            label={item.key ?? item.title}
            triggerLabel={t('specifications.rowActions', { title: item.title })}
          >
            <MenuItem
              leadingIcon="file"
              disabled={!specificationHref}
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
        </div>
      </div>
    </li>
  );
}
