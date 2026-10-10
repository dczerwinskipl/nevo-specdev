import { useTranslation } from 'react-i18next';
import { OperationalGroupHeader } from '../shared/OperationalList';
import { sectionTone, type CurrentSpecSectionId } from './model';

export function SpecSectionHeader({
  label,
  count,
  sectionId,
  expanded,
  searching,
  controls,
  onToggle,
}: {
  readonly label: string;
  readonly count: number;
  readonly sectionId: CurrentSpecSectionId;
  readonly expanded: boolean;
  readonly searching: boolean;
  readonly controls: string;
  readonly onToggle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <OperationalGroupHeader
      label={label}
      count={count}
      tone={sectionTone[sectionId]}
      expanded={expanded}
      controlsId={controls}
      ariaLabel={t(
        searching
          ? 'specifications.sectionSearchExpanded'
          : expanded
            ? 'specifications.collapseSection'
            : 'specifications.expandSection',
        { label },
      )}
      onToggle={() => {
        if (!searching) onToggle();
      }}
      selectable={false}
      ariaDisabled={searching}
    />
  );
}
