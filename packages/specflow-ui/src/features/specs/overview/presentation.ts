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
  | { kind: 'draft' };

interface RowIdentity {
  readonly id: string;
  readonly title: string;
  readonly key?: string;
  readonly progress: { completed: number; total: number };
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
  const executionCount = item.currentExecutions.length;

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
    history:
      item.completedAt !== undefined
        ? { kind: 'completed', timestamp: item.completedAt }
        : { kind: 'archived', timestamp: item.archivedAt },
  };
}

export function sortArchiveItems(items: readonly ArchivedSpecOverviewItem[]) {
  const milestone = (item: ArchivedSpecOverviewItem) => {
    const value = Date.parse(item.completedAt ?? item.archivedAt ?? '');
    return Number.isFinite(value) ? value : -Infinity;
  };
  return [...items].sort((a, b) => {
    const left = milestone(a);
    const right = milestone(b);
    return left === right ? a.id.localeCompare(b.id) : right > left ? 1 : -1;
  });
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
      return { kind: 'active', executionCount: item.currentExecutions.length };

    case 'ready':
      return { kind: 'ready' };

    case 'draft':
      return { kind: 'draft' };
  }
}

export function rowProgress(progress: RowIdentity['progress']): 'invalid' | 'empty' | 'ready' {
  return !Number.isSafeInteger(progress.total) ||
    progress.total < 0 ||
    !Number.isSafeInteger(progress.completed) ||
    progress.completed < 0 ||
    progress.completed > progress.total
    ? 'invalid'
    : progress.total === 0
      ? 'empty'
      : 'ready';
}
type RowMetadataFact =
  { id: string; kind: 'key' | 'tag' | 'omitted'; value: string } | { id: 'pr'; kind: 'pr' };
export function rowMetadata(item: SpecRowModel): readonly RowMetadataFact[] {
  return [
    ...(item.key ? [{ id: 'key', kind: 'key' as const, value: item.key }] : []),
    ...item.tags.map((tag, index) => ({ id: `tag-${index}`, kind: 'tag' as const, value: tag })),
    ...(item.omittedTags
      ? [{ id: 'omitted', kind: 'omitted' as const, value: `+${item.omittedTags}` }]
      : []),
    ...(item.collection === 'current' && item.pullRequests
      ? [{ id: 'pr' as const, kind: 'pr' as const }]
      : []),
  ];
}
