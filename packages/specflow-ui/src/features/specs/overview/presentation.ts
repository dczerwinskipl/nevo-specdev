import type {
  ArchivedSpecOverviewItem,
  CurrentSpecOverviewItem,
  CurrentSpecSectionId,
  CurrentSpecAttentionReason,
  SpecOverviewItem,
} from './model';

type Tags = readonly [] | readonly [string] | readonly [string, string];
type PullRequests =
  { kind: 'single'; number: number; href: string } | { kind: 'multiple'; count: number };

type CurrentSummary =
  | { kind: 'attention'; reason?: CurrentSpecAttentionReason; count?: number }
  | { kind: 'active'; executionCount: number }
  | { kind: 'ready' }
  | { kind: 'draft' }
  | { kind: 'unknown' };

interface RowIdentity {
  readonly id: string;
  readonly title: string;
  readonly key?: string;
  readonly progress: { completed: number; total: number } | null;
  readonly tags: Tags;
  readonly omittedTags: number;
  readonly pullRequests?: PullRequests;
}

export interface CurrentSpecRowModel extends RowIdentity {
  readonly collection: 'current';
  readonly sectionId: CurrentSpecSectionId;
  readonly summary: CurrentSummary;
  readonly qualifier?: { executionCount: number };
}

export interface ArchiveSpecRowModel extends RowIdentity {
  readonly collection: 'archive';
  readonly history:
    { kind: 'completed'; timestamp: string } | { kind: 'archived'; timestamp?: string };
}

export type SpecRowModel = CurrentSpecRowModel | ArchiveSpecRowModel;

function identity(item: SpecOverviewItem): RowIdentity {
  const [first, second] = item.tags ?? [];
  const tags: Tags = first === undefined ? [] : second === undefined ? [first] : [first, second];
  const prs = item.pullRequests ?? [];
  const pr = prs[0];

  return {
    id: item.id,
    title: item.title,
    key: item.key,
    progress: item.progress,
    tags,
    omittedTags: Math.max(0, (item.tags?.length ?? 0) - 2),
    pullRequests:
      prs.length > 1
        ? { kind: 'multiple', count: prs.length }
        : pr
          ? { kind: 'single', number: pr.number, href: pr.url }
          : undefined,
  };
}

export function currentRow(item: CurrentSpecOverviewItem): CurrentSpecRowModel {
  const executionCount = item.currentExecutions?.length ?? 0;

  return {
    ...identity(item),
    collection: 'current',
    sectionId: item.classification.section,
    summary: currentSummary(item),
    qualifier:
      item.classification.section !== 'active' && executionCount > 0
        ? { executionCount }
        : undefined,
  };
}

export function archiveRow(item: ArchivedSpecOverviewItem): ArchiveSpecRowModel {
  return {
    ...identity(item),
    collection: 'archive',
    history: item.completedAt
      ? { kind: 'completed', timestamp: item.completedAt }
      : { kind: 'archived', timestamp: item.archivedAt },
  };
}

function currentSummary(item: CurrentSpecOverviewItem): CurrentSummary {
  switch (item.classification.section) {
    case 'requires-attention':
      return {
        kind: 'attention',
        ...(item.classification.reason === undefined ? {} : { reason: item.classification.reason }),
        ...(item.classification.count === undefined ? {} : { count: item.classification.count }),
      };

    case 'active':
      return { kind: 'active', executionCount: item.currentExecutions?.length ?? 0 };

    case 'ready':
      return { kind: 'ready' };

    case 'draft':
      return { kind: 'draft' };

    case 'unknown':
      return { kind: 'unknown' };
  }
}
