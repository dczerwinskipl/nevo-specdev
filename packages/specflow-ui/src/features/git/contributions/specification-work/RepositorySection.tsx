import { Button, cn } from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import type { RepoContext } from '../../../specs/workspace/model';
import { WorkspaceSection } from '../../../specs/workspace/sections/WorkspaceSection';

export interface RepositorySectionProps {
  readonly repoContext: RepoContext;
  readonly onOpenChanges: (source: 'base' | 'uncommitted' | 'mr') => void;
  readonly onRefresh: () => void | Promise<void>;
}

export function RepositorySection({
  repoContext,
  onOpenChanges,
  onRefresh,
}: RepositorySectionProps) {
  const { t } = useTranslation();

  return (
    <WorkspaceSection aria-labelledby="repo-heading">
      <WorkspaceSection.Header
        id="repo-heading"
        title={t('specification.repositoryHeading')}
        icon="branch"
      />

      <div className="grid gap-2">
        <div className="flex flex-wrap items-baseline gap-3 text-body-sm">
          <span className="font-semibold text-content-primary">{repoContext.branch}</span>
          <span className="text-content-muted">
            {t('specification.baseBranchLabel', { base: repoContext.baseBranch })}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-xs text-content-secondary">
          <span className={cn(repoContext.isDirty && 'text-status-attention')}>
            {repoContext.freshness === 'unknown'
              ? t('specification.gitLocalChangesUnknown')
              : t('specification.uncommittedFilesCount', {
                  count: repoContext.uncommittedCount,
                })}
          </span>
          <span aria-hidden="true" className="text-content-muted">
            ·
          </span>
          <span>
            {repoContext.freshness === 'unknown'
              ? t('specification.gitSyncUnknown')
              : repoContext.syncStatus}
          </span>
          <span aria-hidden="true" className="text-content-muted">
            ·
          </span>
          <span>
            {repoContext.freshness === 'unknown'
              ? t('specification.gitConflictsUnknown')
              : repoContext.conflictStatus}
          </span>
        </div>

        {repoContext.linkedPr ? (
          <div className="flex flex-wrap items-center justify-between gap-3 text-body-sm">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-mono text-body-xs text-content-muted">
                PR #{repoContext.linkedPr.number}
              </span>
              <span className="font-medium text-content-primary">{repoContext.linkedPr.title}</span>
            </div>

            <Button size="sm" variant="secondary" onClick={() => onOpenChanges('mr')}>
              {t('specification.prReviewLink')}
            </Button>
          </div>
        ) : null}

        {repoContext.freshness !== 'fresh' ? (
          <div className="flex items-center gap-3 text-body-xs text-content-muted">
            <span>
              {repoContext.freshness === 'unknown'
                ? t('specification.gitRefreshFailed')
                : t('specification.gitStaleData')}
            </span>
            <button
              type="button"
              onClick={() => void onRefresh()}
              className="font-medium text-accent-primary hover:underline focus-visible:outline-2 focus-visible:outline-focus-ring"
            >
              {t('common.retry')}
            </button>
          </div>
        ) : null}
      </div>

      <WorkspaceSection.Footer>
        <WorkspaceSection.Continuation onClick={() => onOpenChanges('base')}>
          {t('specification.viewChanges')}
        </WorkspaceSection.Continuation>
      </WorkspaceSection.Footer>
    </WorkspaceSection>
  );
}
