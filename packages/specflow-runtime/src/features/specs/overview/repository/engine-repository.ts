import { createHash } from 'node:crypto';
import {
  readCanonicalSpecSources,
  type CanonicalSpecSource,
  type SpecFlowEngine,
} from '@nevo/specflow-engine';

import { SpecsReadError } from '../../read/error';
import type { ArchivedSpecRecord, CurrentSpecRecord, SpecOverviewRecord } from './model';
import type { SpecsOverviewRepository } from './read-repository';

/**
 * Live Overview projection of Engine-verified canonical manifests.
 * Never reads generated indexes, primary fallbacks or demonstration records.
 */
export function createEngineSpecsOverviewRepository(
  engine: SpecFlowEngine,
): SpecsOverviewRepository {
  async function read(isVisibleSpec?: (specId: string) => boolean) {
    const discovered = await readCanonicalSpecSources(engine, isVisibleSpec);
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
    const available = discovered.filter(
      (item): item is Extract<CanonicalSpecSource, { status: 'available' }> =>
        item.status === 'available',
    );
    const projected = await Promise.all(available.map(project));
    const revision = createHash('sha256').update(JSON.stringify(projected)).digest('hex');
    return { revision, items: projected };
  }

  return {
    async readCurrent(isVisibleSpec) {
      const snapshot = await read(isVisibleSpec);
      return {
        revision: snapshot.revision,
        items: snapshot.items
          .filter((item) => item.location === 'active')
          .map((item) => item.current),
      };
    },
    async readArchive(isVisibleSpec) {
      const snapshot = await read(isVisibleSpec);
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
  const common: SpecOverviewRecord = {
    id: item.specId,
    title: spec.title,
    updatedAt: item.sourceUpdatedAt,
    // Engine currently owns no verified task outcome/progress projection.
    progress: null,
  };
  const current: CurrentSpecRecord = {
    ...common,
    // Manifest status is not proof of execution or human-attention state.
    readyForWork: null,
    signals: null,
    currentExecutions: null,
  };
  const archive: ArchivedSpecRecord = common;
  return {
    location: spec.location,
    current,
    archive,
    // Canonical metadata changes must change revision even if DTO projection
    // cannot yet represent that property (e.g. status or priority).
    evidence: {
      ...spec,
      workspaceId: item.workspaceId,
      binding: item.binding,
      sourceRevision: item.sourceRevision,
    },
  };
}
