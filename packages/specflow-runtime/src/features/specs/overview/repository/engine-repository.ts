import { createHash } from 'node:crypto';
import { lstat } from 'node:fs/promises';
import { join } from 'node:path';

import {
  discoverSpecifications,
  type DiscoveredSpecification,
  type SpecFlowEngine,
} from '@nevo/specflow-engine';

import { SpecsReadError } from '../../read/error';
import type { ArchivedSpecRecord, CurrentSpecRecord, SpecOverviewRecord } from './model';
import type { SpecsOverviewRepository } from './read-repository';

/**
 * Live Overview projection of Engine-verified canonical manifests.
 * Never reads generated indexes, primary fallbacks or demonstration records.
 */
export function createEngineSpecsOverviewRepository(engine: SpecFlowEngine): SpecsOverviewRepository {
  async function read() {
    const discovered = await discoverSpecifications(engine);
    // The existing Overview DTO cannot represent unavailable canonical rows.
    // Fail closed with typed 503 instead of silently losing a bound Spec.
    for (const item of discovered) {
      if (item.status === 'workspace_unavailable') {
        throw new SpecsReadError(
          'SPEC_WORKSPACE_UNAVAILABLE',
          'A canonical specification workspace is unavailable.',
        );
      }
      if (item.status === 'manifest_missing') {
        throw new SpecsReadError(
          'SPEC_MANIFEST_MISSING',
          'A bound canonical specification manifest is missing.',
        );
      }
    }
    const projected = await Promise.all(discovered.map(project));
    const revision = createHash('sha256')
      .update(JSON.stringify(projected))
      .digest('hex');
    return { revision, items: projected };
  }

  return {
    async readCurrent() {
      const snapshot = await read();
      return {
        revision: snapshot.revision,
        items: snapshot.items
          .filter((item) => item.location === 'active')
          .map((item) => item.current),
      };
    },
    async readArchive() {
      const snapshot = await read();
      return {
        revision: snapshot.revision,
        items: snapshot.items
          .filter((item) => item.location === 'archive')
          .map((item) => item.archive),
      };
    },
  };
}

async function project(item: Extract<DiscoveredSpecification, { status: 'available' }>) {
  const spec = item.specification;
  const path = join(item.workspaceRoot, spec.relativeManifestPath);
  let updatedAt: string;
  try {
    const file = await lstat(path);
    if (!file.isFile() || file.isSymbolicLink()) {
      throw new SpecsReadError('SPEC_SOURCE_UNAVAILABLE', 'Manifest is not a regular file.');
    }
    updatedAt = file.mtime.toISOString();
  } catch (error) {
    if (error instanceof SpecsReadError) throw error;
    throw new SpecsReadError('SPEC_SOURCE_UNAVAILABLE', 'Canonical manifest metadata unavailable.');
  }
  const common: SpecOverviewRecord = {
    id: item.specId,
    title: spec.title,
    updatedAt,
    // Task completion, signals and active sessions are not yet authoritative
    // Engine facts. Do not guess completed task counts or invent attention.
    progress: { completed: 0, total: spec.tasks.length },
  };
  const current: CurrentSpecRecord = {
    ...common,
    readyForWork: spec.status === 'ready',
    signals: [],
    currentExecutions: [],
  };
  const archive: ArchivedSpecRecord = common;
  return {
    location: spec.location,
    current,
    archive,
    // Canonical metadata changes must change revision even if DTO projection
    // cannot yet represent that property (e.g. status or priority).
    evidence: { ...spec, workspaceId: item.workspaceId, binding: item.binding },
  };
}
