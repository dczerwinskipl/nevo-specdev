import type { HttpRequestClient } from '@nevo/http-client';
import type { SpecificationDocumentResponse } from '@nevo/specflow-contracts/specs/workspace';

export interface DocumentApi {
  getDocument(
    specId: string,
    documentId: string,
    signal?: AbortSignal,
    revision?: string,
  ): Promise<SpecificationDocumentResponse>;
}

export function createRuntimeDocumentApi(http: HttpRequestClient): DocumentApi {
  return {
    getDocument: (specId, documentId, signal, revision) =>
      http.get<SpecificationDocumentResponse>(
        `/api/specs/${encodeURIComponent(specId)}/documents/${encodeURIComponent(documentId)}${revision === undefined ? '' : `?revision=${encodeURIComponent(revision)}`}`,
        { signal },
      ),
  };
}
