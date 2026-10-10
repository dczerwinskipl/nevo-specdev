import { Button, SegmentedControl, Typography } from '@nevo/ui';
import { useTranslation } from 'react-i18next';

import type { SpecificationChangesData } from '../../specs/workspace/model';

export interface ChangesViewProps {
  readonly currentSource: 'base' | 'uncommitted' | 'mr';
  readonly changes?: SpecificationChangesData;
  readonly onSourceChange: (source: 'base' | 'uncommitted' | 'mr') => void;
  readonly onDiff?: (file: string) => void;
}

export function ChangesView({ currentSource, changes, onSourceChange, onDiff }: ChangesViewProps) {
  const { t } = useTranslation();

  const files = (changes ? changes[currentSource] : undefined) ?? [];

  return (
    <div className="grid max-w-content-standard gap-6 py-2">
      <div>
        <Typography as="h2" variant="title-md" className="font-semibold text-content-primary">
          {t('specification.changesHeading')}
        </Typography>
        <Typography variant="body-sm" className="mt-1 text-content-muted">
          {t('specification.changesWorktreeContext')}
        </Typography>
      </div>

      <SegmentedControl
        value={currentSource}
        onValueChange={(val) => onSourceChange(val as 'base' | 'uncommitted' | 'mr')}
        aria-label={t('specification.changesSourceLabel')}
      >
        <SegmentedControl.Item value="base">
          {t('specification.changesSourceBase')}
        </SegmentedControl.Item>
        <SegmentedControl.Item value="uncommitted">
          {t('specification.changesSourceUncommitted')}
        </SegmentedControl.Item>
        <SegmentedControl.Item value="mr">
          {t('specification.changesSourcePr')}
        </SegmentedControl.Item>
      </SegmentedControl>

      <Typography variant="body-sm" className="text-content-secondary">
        {currentSource === 'base'
          ? t('specification.changesBaseDescription')
          : currentSource === 'uncommitted'
            ? t('specification.changesUncommittedDescription')
            : t('specification.changesPrDescription')}
      </Typography>

      {files.length > 0 ? (
        <div className="divide-y divide-border-subtle">
          {files.map((file) => (
            <div key={file} className="flex items-center justify-between gap-4 py-3">
              <span className="font-mono text-body-sm text-content-primary [overflow-wrap:anywhere]">
                {file}
              </span>
              {onDiff ? (
                <Button variant="secondary" size="sm" onClick={() => onDiff(file)}>
                  {t('specification.diffAction')}
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-control border border-border-subtle bg-surface-subtle p-4 text-body-sm text-content-muted">
          {t('specification.noChangesNotice')}
        </div>
      )}
    </div>
  );
}
