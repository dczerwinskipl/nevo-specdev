/** Shared parsing for the collection carried by Specification routes. */
export function parseSpecificationCollection(
  search: Record<string, unknown>,
): 'current' | 'archive' {
  return search.collection === 'archive' ? 'archive' : 'current';
}
