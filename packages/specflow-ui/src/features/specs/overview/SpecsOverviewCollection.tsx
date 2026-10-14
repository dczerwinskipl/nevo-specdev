import { useId, useState, type ReactNode } from 'react';
import { InformationList, Typography } from '@nevo/ui';
import { useTranslation } from 'react-i18next';

import { sectionTranslationKey, type SpecsOverview, type CurrentSpecTarget } from './model';
import { archiveRow, currentRow, sortArchiveItems } from './presentation';
import { SpecSectionHeader } from './SpecSectionHeader';
import { SpecListRow } from './SpecListRow';

export function SpecsOverviewCollection({
  projection,
  onOpenTarget,
  specificationHref,
  renderSpecificationLink,
  searching = false,
}: {
  readonly projection: SpecsOverview;
  readonly onOpenTarget?: (target: CurrentSpecTarget) => void;
  readonly specificationHref?: (id: string) => string;
  readonly renderSpecificationLink?: (
    specId: string,
    children: ReactNode,
    ariaLabel: string,
  ) => ReactNode;
  readonly searching?: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());

  if (projection.collection === 'archive') {
    return (
      <div className="@container/collection min-w-0">
        {projection.items.length ? (
          <Typography variant="body-sm" className="mb-3 text-content-secondary">
            {t('specifications.newestMilestoneFirst')}
          </Typography>
        ) : null}
        <OverviewColumns archive />
        <InformationList>
          {sortArchiveItems(projection.items).map((item) => (
            <SpecListRow
              key={item.id}
              item={archiveRow(item)}
              specificationHref={specificationHref?.(item.id)}
              onOpenTarget={onOpenTarget}
              renderSpecificationLink={renderSpecificationLink}
            />
          ))}
        </InformationList>
      </div>
    );
  }

  return (
    <div className="@container/collection grid min-w-0 gap-5 @min-[40rem]/collection:gap-6">
      <OverviewColumns />
      {projection.sections.map((section) => {
        const rows = projection.items.filter((item) => item.classification.section === section);
        if (!rows.length) return null;

        const expanded = searching || !collapsed.has(section);
        const controls = id + '-' + section;

        return (
          <section
            className="grid min-w-0 gap-2"
            key={section}
            aria-label={t(sectionTranslationKey[section])}
          >
            <SpecSectionHeader
              label={t(sectionTranslationKey[section])}
              count={rows.length}
              sectionId={section}
              expanded={expanded}
              searching={searching}
              controls={controls}
              onToggle={() =>
                setCollapsed((current) => {
                  const next = new Set(current);
                  if (next.has(section)) next.delete(section);
                  else next.add(section);
                  return next;
                })
              }
            />
            {expanded ? (
              <InformationList id={controls}>
                {rows.map((item) => (
                  <SpecListRow
                    key={item.id}
                    item={currentRow(item)}
                    specificationHref={specificationHref?.(item.id)}
                    onOpenTarget={onOpenTarget}
                    renderSpecificationLink={renderSpecificationLink}
                  />
                ))}
              </InformationList>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function OverviewColumns({ archive = false }: { archive?: boolean }) {
  const { t } = useTranslation();
  return (
    <Typography
      as="div"
      variant="body-sm"
      aria-hidden="true"
      data-spec-columns
      className={`hidden min-w-0 gap-x-6 pl-2 pr-14 text-content-secondary @min-[48rem]/collection:grid ${archive ? 'grid-cols-[minmax(0,1fr)_12rem_6rem]' : 'grid-cols-[minmax(0,1fr)_15rem_7rem]'}`}
    >
      <span>{t('specifications.specificationColumn')}</span>
      <span>
        {t(archive ? 'specifications.milestoneColumn' : 'specifications.situationColumn')}
      </span>
      <span>{archive ? 'PR' : t('specifications.progressColumn')}</span>
    </Typography>
  );
}
