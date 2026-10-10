import { Button, Typography } from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import type { RepoContext } from '../../specs/workspace/model';

export interface RepositoryViewProps {
  readonly repoContext?: RepoContext;
  readonly onGoToChanges: () => void;
}

export function RepositoryView({ repoContext, onGoToChanges }: RepositoryViewProps) {
  const { t } = useTranslation();

  const facts: [string, string][] = [
    [
      t('specification.repoFactLastPr'),
      repoContext?.linkedPr
        ? `#${repoContext.linkedPr.number} · ${repoContext.linkedPr.title} · ${t('specification.repoPrOpen')}`
        : t('specification.repoNone'),
    ],
    [
      t('specification.repoFactOtherPrs'),
      repoContext?.otherPrs && repoContext.otherPrs.length > 0
        ? repoContext.otherPrs.map((pr) => `#${pr.number} · ${pr.title} · ${pr.status}`).join('; ')
        : t('specification.repoNone'),
    ],
    [
      t('specification.repoFactLocalConflicts'),
      repoContext?.conflictStatus ?? t('specification.repoNoConflicts'),
    ],
    [t('specification.repoFactIntegrationStatus'), t('specification.repoNotChecked')],
    [t('specification.repoFactRepository'), repoContext?.repositoryName ?? t('common.unknown')],
    [t('specification.repoFactContext'), t('specification.repoFactWorktreeDesc')],
    [t('specification.repoFactBranch'), repoContext?.branch ?? t('common.unknown')],
    [t('specification.repoFactBaseBranch'), repoContext?.baseBranch ?? t('common.unknown')],
    [
      t('specification.repoFactLocalState'),
      repoContext?.freshness === 'unknown'
        ? t('specification.gitLocalChangesUnknown')
        : typeof repoContext?.uncommittedCount === 'number'
          ? t('specification.uncommittedFilesCount', { count: repoContext.uncommittedCount })
          : t('common.unknown'),
    ],
    [
      t('specification.repoFactSync'),
      repoContext?.freshness === 'unknown'
        ? t('specification.gitSyncUnknown')
        : (repoContext?.syncStatus ?? t('common.unknown')),
    ],
  ];

  return (
    <div className="grid max-w-content-standard gap-6 py-2">
      <Typography as="h2" variant="title-md" className="font-semibold text-content-primary">
        {t('specification.repositoryHeading')}
      </Typography>

      <div className="divide-y divide-border-subtle">
        {facts.map(([label, value], index) => (
          <div key={index} className="grid gap-1 py-3">
            <span className="text-body-xs text-content-muted">{label}</span>
            <span className="font-medium text-content-primary [overflow-wrap:anywhere]">
              {value}
            </span>
          </div>
        ))}
      </div>

      <div>
        <Button variant="secondary" onClick={onGoToChanges}>
          {t('specification.goToChanges')}
        </Button>
      </div>
    </div>
  );
}
