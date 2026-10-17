import type { ResolvedProjectHome } from '../../project/project-home';
import type { CreateJournal } from '../create-journal';
import { listCreateJournals } from '../create-journal';
import { CloseOperationError, type CloseJournal } from './model';
import { listCloseJournals } from './journal-store';

export type MutationResource = string;

export function resourcesForCreate(record: CreateJournal): readonly MutationResource[] {
  const shared = ['spec:' + record.specId];
  if (record.target.kind === 'existing') {
    return sortedResources([...shared, 'checkout:' + record.target.workspaceId]);
  }
  return sortedResources([
    ...shared,
    'ref:refs/heads/' + record.target.branch.toLowerCase(),
    'worktree-path:' + record.target.workspaceRoot.toLowerCase(),
    'git-worktree-admin:' + record.projectId,
  ]);
}

export function sortedResources(resources: readonly string[]): readonly MutationResource[] {
  return [...new Set(resources)].sort();
}

export function overlaps(left: readonly string[], right: readonly string[]): boolean {
  const selected = new Set(left);
  return right.some((item) => selected.has(item));
}

function settledClose(journal: CloseJournal): boolean {
  return journal.stage === 'completed' || journal.stage === 'archived-linked-awaiting-integration';
}

/** Call ONLY inside an existing short Project Home control-lock scope. */
export async function assertResourcesAvailable(
  context: ResolvedProjectHome,
  resources: readonly string[],
  self?: { readonly kind: 'create' | 'close'; readonly operationId: string },
): Promise<void> {
  const [creates, closes] = await Promise.all([
    listCreateJournals(context),
    listCloseJournals(context),
  ]);
  for (const record of creates) {
    if (self?.kind === 'create' && self.operationId === record.operationId) continue;
    if (record.stage === 'completed') continue;
    if (overlaps(resources, resourcesForCreate(record))) {
      throw new CloseOperationError(
        'CLOSE_CONFLICT',
        'An unfinished Create operation reserves a shared checkout/ref; inspect or recover it.',
      );
    }
  }
  for (const record of closes) {
    if (self?.kind === 'close' && self.operationId === record.plan.operationId) continue;
    if (settledClose(record)) continue;
    if (overlaps(resources, record.plan.resources)) {
      throw new CloseOperationError(
        'CLOSE_CONFLICT',
        'An unfinished Close operation reserves a shared checkout/ref; inspect or recover it.',
      );
    }
  }
}
