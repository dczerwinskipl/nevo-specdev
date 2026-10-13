import { SpecCapabilities } from '@nevo/specflow-contracts/specs';
import type { RequestAuthorization } from '../../auth';

export interface DocumentContentSource {
  read(
    specId: string,
    documentId: string,
    revision?: string,
  ): Promise<
    | {
        kind: 'ok';
        document: { specId: string; id: string; title: string; content: string; revision: string };
      }
    | { kind: 'not_found' | 'revision_unavailable' | 'unavailable' }
  >;
}
export async function readDocumentContent(
  source: DocumentContentSource | undefined,
  specId: string,
  documentId: string,
  revision: string | undefined,
  authz: RequestAuthorization,
) {
  authz.require({
    resource: SpecCapabilities,
    capability: SpecCapabilities.capabilities.View,
    scope: { specId },
  });
  if (!source) return { kind: 'unavailable' } as const;
  const result = await source.read(specId, documentId, revision);
  if (result.kind !== 'ok') return result;
  const document = result.document;
  if (document.specId !== specId || document.id !== documentId)
    return { kind: 'unavailable' } as const;
  if (revision !== undefined && document.revision !== revision)
    return { kind: 'revision_unavailable' } as const;
  return {
    kind: 'ok',
    value: {
      id: document.id,
      title: document.title,
      content: document.content,
      revision: document.revision,
    },
  } as const;
}
