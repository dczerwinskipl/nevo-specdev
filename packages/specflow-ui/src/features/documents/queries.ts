/** Document cache stays under the Specification identity for scoped invalidation. */
export const documentKeys = {
  detail: (specId: string, documentId: string, revision?: string) =>
    ['specifications', specId, 'document', documentId, { revision: revision ?? null }] as const,
};
