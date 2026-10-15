import {
  readCanonicalSpecDocument,
  resolveSpecification,
  type DiscoveredSpecification,
  type SpecFlowEngine,
} from '@nevo/specflow-engine';

export type CanonicalSpecRead<T> =
  | { readonly status: 'available'; readonly value: T }
  | { readonly status: 'workspace_unavailable'; readonly reason: string }
  | { readonly status: 'manifest_missing' }
  | { readonly status: 'document_missing' };

export interface CanonicalWorkspace {
  readonly workspaceId: string;
  readonly workspaceRoot: string;
  readonly relativeManifestPath: string;
}

export interface CanonicalDocument {
  readonly relativePath: string;
  readonly content: string;
}

/**
 * Internal canonical read ports. HTTP endpoints must authorize each specId
 * BEFORE invoking a port. Do not expose raw workspace paths as request input.
 * Domain/task DTOs and corresponding HTTP routes belong to a separate contract gate.
 */
export interface EngineSpecsReadRepository {
  readWorkspace(specId: string): Promise<CanonicalSpecRead<CanonicalWorkspace>>;
  readDocument(
    specId: string,
    kind: 'manifest' | 'overview',
  ): Promise<CanonicalSpecRead<CanonicalDocument>>;
}

export function createEngineSpecsReadRepository(engine: SpecFlowEngine): EngineSpecsReadRepository {
  const resolve = (specId: string) => resolveSpecification(engine, specId);

  return {
    async readWorkspace(specId) {
      const found = await resolve(specId);
      if (found.status !== 'available') return unavailable(found);
      return {
        status: 'available',
        value: {
          workspaceId: found.workspaceId,
          workspaceRoot: found.workspaceRoot,
          relativeManifestPath: found.specification.relativeManifestPath,
        },
      };
    },
    async readDocument(specId, kind) {
      const source = await readCanonicalSpecDocument(engine, specId, kind);
      if (source.status !== 'available') return source;
      return {
        status: 'available',
        value: { relativePath: source.relativePath, content: source.content },
      };
    },
  };
}

function unavailable(
  found: Exclude<DiscoveredSpecification, { readonly status: 'available' }>,
): CanonicalSpecRead<never> {
  return found.status === 'workspace_unavailable'
    ? { status: 'workspace_unavailable', reason: found.reason }
    : { status: 'manifest_missing' };
}

