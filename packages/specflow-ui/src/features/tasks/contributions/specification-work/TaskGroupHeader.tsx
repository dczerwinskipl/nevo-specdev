import { useTranslation } from 'react-i18next';
import { OperationalGroupHeader } from '../../../specs/shared/OperationalList';

export interface TaskGroupHeaderProps {
  readonly name: string;
  readonly count: number;
  readonly isCollapsed: boolean;
  readonly tone: 'attention' | 'info' | 'neutral' | 'success';
  readonly controlsId?: string;
  readonly onToggle: () => void;
}

export function TaskGroupHeader({
  name,
  count,
  isCollapsed,
  tone,
  controlsId,
  onToggle,
}: TaskGroupHeaderProps) {
  const { t } = useTranslation();

  return (
    <OperationalGroupHeader
      headingTag="h4"
      label={name}
      count={count}
      tone={tone}
      expanded={!isCollapsed}
      controlsId={controlsId}
      ariaLabel={t(
        isCollapsed ? 'specifications.expandSection' : 'specifications.collapseSection',
        { label: name },
      )}
      onToggle={onToggle}
      selectable
    />
  );
}
