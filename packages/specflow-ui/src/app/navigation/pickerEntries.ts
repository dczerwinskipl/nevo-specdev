import type { SpecOverviewItem } from '../../features/specs/overview/model';
export function pickerEntries(
  items: readonly SpecOverviewItem[],
  current: { id: string; title: string; key?: string } | undefined,
  term: string,
) {
  const query = term.trim().toLocaleLowerCase();
  const matches = (item: { title: string; key?: string }) =>
    [item.title, item.key ?? ''].some((value) => value.toLocaleLowerCase().includes(query));
  return [
    ...(current && matches(current) ? [current] : []),
    ...items.filter((item) => item.id !== current?.id && matches(item)).slice(0, 5),
  ];
}
