/** Document cache stays under the Specification identity for scoped invalidation. */
export const documentKeys = {
  detail: (specId: string, documentId: string) =>
    ['specifications', specId, 'document', documentId] as const,
};
