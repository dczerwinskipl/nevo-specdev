import { useId, useState, type ReactNode } from 'react';
import { InformationList } from '@nevo/ui';
import { useTranslation } from 'react-i18next';

import { sectionTranslationKey, type SpecsOverview, type CurrentSpecTarget } from './model';
import { archiveRow, currentRow } from './presentation';
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
      <InformationList>
        {projection.items.map((item) => (
          <SpecListRow
            key={item.id}
            item={archiveRow(item)}
            specificationHref={specificationHref?.(item.id)}
            onOpenTarget={onOpenTarget}
            renderSpecificationLink={renderSpecificationLink}
          />
        ))}
      </InformationList>
    );
  }

  return (
    <div className="grid min-w-0 gap-4">
      {projection.sections.map((section) => {
        const rows = projection.items.filter((item) => item.classification.section === section);
        if (!rows.length) return null;

        const expanded = searching || !collapsed.has(section);
        const controls = id + '-' + section;

        return (
          <section className="min-w-0" key={section} aria-label={t(sectionTranslationKey[section])}>
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
