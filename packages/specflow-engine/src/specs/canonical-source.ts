import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';

import { parse } from 'yaml';

import type { SpecFlowEngine } from '../application';
import { discoverSpecifications, resolveSpecification, type DiscoveredSpecification } from './discovery';
import { parseSpecificationManifest, SpecificationError } from './model';

type AvailableSpec = Extract<DiscoveredSpecification, { readonly status: 'available' }>;

export type CanonicalSpecSource =
  | Exclude<DiscoveredSpecification, { readonly status: 'available' }>
  | (AvailableSpec & {
      readonly sourceUpdatedAt: string;
      readonly sourceRevision: string;
    });

export type CanonicalDocumentRead =
  | { readonly status: 'available'; readonly relativePath: string; readonly content: string; readonly sourceRevision: string }
  | { readonly status: 'workspace_unavailable'; readonly reason: string }
  | { readonly status: 'manifest_missing' }
  | { readonly status: 'document_missing' };

/**
 * Engine owns canonical bytes, provenance and validation; Runtime owns projections.
 * A scoped read skips excluded linked bindings, but still validates all primary
 * manifests because unbound primary identities cannot be enumerated without them.
 */
export async function readCanonicalSpecSources(
  engine: SpecFlowEngine,
  isIncluded?: (specId: string) => boolean,
): Promise<readonly CanonicalSpecSource[]> {
  const discovered = await discoverSpecifications(engine, isIncluded);
  return Promise.all(
    discovered.map(async (item): Promise<CanonicalSpecSource> => {
      if (item.status !== 'available') return item;
      const source = await readPhysicalDocument(item, 'manifest');
      if (!source) {
        throw new SpecificationError('SPEC_SOURCE_INVALID', 'Canonical manifest disappeared during read.');
      }
      let latest;
      try {
        latest = parseSpecificationManifest(
          parse(source.content) as unknown,
          item.specification.slug,
          item.specification.location,
        );
      } catch {
        throw new SpecificationError('SPEC_SOURCE_INVALID', 'Canonical manifest changed or became invalid during read.');
      }
      if (latest.specId !== item.specId) {
        throw new SpecificationError('SPEC_SOURCE_INVALID', 'Canonical manifest identity changed during read.');
      }
      return {
        ...item,
        specification: { ...latest, relativeManifestPath: item.specification.relativeManifestPath, relativeOverviewPath: item.specification.relativeOverviewPath },
        sourceUpdatedAt: source.updatedAt,
        sourceRevision: source.revision,
      };
    }),
  );
}

/** Authorized callers select specId; filesystem paths never cross into Runtime. */
export async function readCanonicalSpecDocument(
  engine: SpecFlowEngine,
  specId: string,
  kind: 'manifest' | 'overview',
): Promise<CanonicalDocumentRead> {
  const found = await resolveSpecification(engine, specId);
  if (found.status === 'workspace_unavailable') {
    return { status: 'workspace_unavailable', reason: found.reason };
  }
  if (found.status === 'manifest_missing') return { status: 'manifest_missing' };
  const source = await readPhysicalDocument(found, kind);
  if (!source) {
    return kind === 'manifest' ? { status: 'manifest_missing' } : { status: 'document_missing' };
  }
  return {
    status: 'available',
    relativePath: source.relativePath,
    content: source.content,
    sourceRevision: source.revision,
  };
}

async function readPhysicalDocument(
  found: AvailableSpec,
  kind: 'manifest' | 'overview',
): Promise<{ readonly relativePath: string; readonly content: string; readonly updatedAt: string; readonly revision: string } | undefined> {
  const relativePath = kind === 'manifest'
    ? found.specification.relativeManifestPath
    : found.specification.relativeOverviewPath;
  const path = join(found.workspaceRoot, relativePath);
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || (await realpath(path)) !== path) {
      throw new SpecificationError('SPEC_SOURCE_INVALID', 'Canonical document is redirected.');
    }
    const content = await readFile(path, 'utf8');
    return {
      relativePath,
      content,
      updatedAt: stat.mtime.toISOString(),
      revision: createHash('sha256').update(content, 'utf8').digest('hex'),
    };
  } catch (error) {
    if (isMissing(error)) return undefined;
    if (error instanceof SpecificationError) throw error;
    throw new SpecificationError('SPEC_SOURCE_INVALID', 'Canonical document source is unavailable.');
  }
}

function isMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
