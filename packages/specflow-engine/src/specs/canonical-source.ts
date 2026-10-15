import { createHash } from 'node:crypto';
import { lstat, open, realpath } from 'node:fs/promises';
import { join } from 'node:path';

import { parse } from 'yaml';

import type { SpecFlowEngine } from '../application';
import {
  discoverSpecifications,
  resolveSpecification,
  type DiscoveredSpecification,
} from './discovery';
import { parseSpecificationManifest, SpecificationError } from './model';

type AvailableSpec = Extract<DiscoveredSpecification, { readonly status: 'available' }>;

export type CanonicalSpecSource =
  | Exclude<DiscoveredSpecification, { readonly status: 'available' }>
  | (AvailableSpec & {
      readonly sourceUpdatedAt: string;
      readonly sourceRevision: string;
    });

export type CanonicalDocumentRead =
  | {
      readonly status: 'available';
      readonly relativePath: string;
      readonly content: string;
      readonly sourceRevision: string;
    }
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
  // Discovery validates a registry snapshot, but files are opened afterwards.
  // Detect a new binding/registration published during that second stage.
  const revision = (await engine.readRegistry()).revision;
  const discovered = await discoverSpecifications(engine, isIncluded);
  const sources = await Promise.all(
    discovered.map(async (item): Promise<CanonicalSpecSource> => {
      if (item.status !== 'available') return item;
      const source = await readPhysicalDocument(item, 'manifest');
      if (!source) {
        throw new SpecificationError(
          'SPEC_SOURCE_INVALID',
          'Canonical manifest disappeared during read.',
        );
      }
      let latest;
      try {
        latest = parseSpecificationManifest(
          parse(source.content) as unknown,
          item.specification.slug,
          item.specification.location,
        );
      } catch {
        throw new SpecificationError(
          'SPEC_SOURCE_INVALID',
          'Canonical manifest changed or became invalid during read.',
        );
      }
      if (latest.specId !== item.specId) {
        throw new SpecificationError(
          'SPEC_SOURCE_INVALID',
          'Canonical manifest identity changed during read.',
        );
      }
      return {
        ...item,
        specification: {
          ...latest,
          relativeManifestPath: item.specification.relativeManifestPath,
          relativeOverviewPath: item.specification.relativeOverviewPath,
        },
        sourceUpdatedAt: source.updatedAt,
        sourceRevision: source.revision,
      };
    }),
  );
  await assertRegistryRevision(engine, revision);
  return sources;
}

/** Authorized callers select specId; filesystem paths never cross into Runtime. */
export async function readCanonicalSpecDocument(
  engine: SpecFlowEngine,
  specId: string,
  kind: 'manifest' | 'overview',
): Promise<CanonicalDocumentRead> {
  const revision = (await engine.readRegistry()).revision;
  const found = await resolveSpecification(engine, specId);
  let result: CanonicalDocumentRead;
  if (found.status === 'workspace_unavailable') {
    result = { status: 'workspace_unavailable', reason: found.reason };
  } else if (found.status === 'manifest_missing') {
    result = { status: 'manifest_missing' };
  } else {
    const source = await readPhysicalDocument(found, kind);
    if (!source) {
      result =
        kind === 'manifest' ? { status: 'manifest_missing' } : { status: 'document_missing' };
    } else {
      if (kind === 'manifest') {
        let current;
        try {
          current = parseSpecificationManifest(
            parse(source.content) as unknown,
            found.specification.slug,
            found.specification.location,
          );
        } catch {
          throw new SpecificationError(
            'SPEC_SOURCE_INVALID',
            'Canonical manifest became invalid during document read.',
          );
        }
        if (current.specId !== specId) {
          throw new SpecificationError(
            'SPEC_SOURCE_INVALID',
            'Canonical manifest identity changed during document read.',
          );
        }
      }
      result = {
        status: 'available',
        relativePath: source.relativePath,
        content: source.content,
        sourceRevision: source.revision,
      };
    }
  }
  await assertRegistryRevision(engine, revision);
  return result;
}

async function assertRegistryRevision(engine: SpecFlowEngine, revision: number): Promise<void> {
  if ((await engine.readRegistry()).revision !== revision) {
    throw new SpecificationError(
      'SPEC_CONFLICT',
      'Canonical Specification binding changed during read. Re-read the source.',
    );
  }
}

interface PhysicalSource {
  readonly relativePath: string;
  readonly content: string;
  readonly updatedAt: string;
  readonly revision: string;
}

async function readPhysicalDocument(
  found: AvailableSpec,
  kind: 'manifest' | 'overview',
): Promise<PhysicalSource | undefined> {
  const relativePath =
    kind === 'manifest'
      ? found.specification.relativeManifestPath
      : found.specification.relativeOverviewPath;
  const path = join(found.workspaceRoot, relativePath);
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || (await realpath(path)) !== path) {
      throw new SpecificationError('SPEC_SOURCE_INVALID', 'Canonical document is redirected.');
    }
    // Metadata and bytes must come from the same opened file, not two paths
    // that could refer to different files during a concurrent atomic replace.
    const handle = await open(path, 'r');
    try {
      const openedStat = await handle.stat();
      if (!openedStat.isFile()) {
        throw new SpecificationError('SPEC_SOURCE_INVALID', 'Canonical document is not a file.');
      }
      const content = await handle.readFile('utf8');
      return {
        relativePath,
        content,
        updatedAt: openedStat.mtime.toISOString(),
        revision: createHash('sha256').update(content, 'utf8').digest('hex'),
      };
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (isMissing(error)) return undefined;
    if (error instanceof SpecificationError) throw error;
    throw new SpecificationError(
      'SPEC_SOURCE_INVALID',
      'Canonical document source is unavailable.',
    );
  }
}

function isMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
