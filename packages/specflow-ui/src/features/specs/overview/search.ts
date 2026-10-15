import type { SpecOverviewItem, SpecsOverview } from './model';

export function filterSpecsOverview(projection: SpecsOverview, query: string): SpecsOverview {
  const term = query.trim().toLowerCase();
  if (!term) return projection;

  const matches = (item: SpecOverviewItem) =>
    [
      item.title,
      item.key ?? '',
      ...(item.tags ?? []),
      ...(item.pullRequests ?? []).map((pr) => `PR #${pr.number}`),
    ].some((field) => field.toLowerCase().includes(term));

  if (projection.collection === 'archive') {
    return { ...projection, items: projection.items.filter(matches) };
  }

  return { ...projection, items: projection.items.filter(matches) };
}
