import type {
  CurrentSpecOverviewItem,
  CurrentSpecSectionId,
  CurrentSpecsOverview,
} from '@nevo/specflow-contracts/specs/overview';

import type { RequestAuthorization } from '../../../auth';
import type { SpecsOverviewRepository } from '../repository/read-repository';
import type { CurrentSpecRecord } from '../repository/model';
import { canViewSpec, filterAuthorizedSpecs } from '../filter-authorized-specs';
import { classifyCurrentSpec } from './classify-spec';

export interface GetCurrentOverviewDependencies {
  readonly authorization: RequestAuthorization;
  readonly repository: SpecsOverviewRepository;
  readonly sections: readonly CurrentSpecSectionId[];
}

export async function getCurrentOverview(
  dependencies: GetCurrentOverviewDependencies,
): Promise<CurrentSpecsOverview> {
  const snapshot = await dependencies.repository.readCurrent((specId) =>
    canViewSpec(dependencies.authorization, specId),
  );
  const visible = filterAuthorizedSpecs(dependencies.authorization, snapshot.items);
  const candidates = visible.map(toOverviewItem);
  // Unknown sources must never disappear merely because a legacy project
  // configured the four pre-E2.T06 sections explicitly.
  const sections: CurrentSpecSectionId[] = [...dependencies.sections];
  if (
    !sections.includes('unknown') &&
    candidates.some((item) => item.classification.section === 'unknown')
  ) {
    sections.push('unknown');
  }
  const items = candidates.filter((item) => sections.includes(item.classification.section));

  return {
    revision: snapshot.revision,
    collection: 'current',
    sections,
    items,
  };
}

function toOverviewItem(spec: CurrentSpecRecord): CurrentSpecOverviewItem {
  return {
    id: spec.id,
    title: spec.title,
    ...(spec.key === undefined ? {} : { key: spec.key }),
    ...(spec.pullRequests === undefined ? {} : { pullRequests: [...spec.pullRequests] }),
    ...(spec.tags === undefined ? {} : { tags: [...spec.tags] }),
    updatedAt: spec.updatedAt,
    progress: spec.progress,
    classification: classifyCurrentSpec(spec),
    signals: spec.signals?.map((signal) => ({ ...signal })) ?? null,
    currentExecutions:
      spec.currentExecutions?.map((execution) => ({
        ...execution,
        taskIds: [...execution.taskIds],
      })) ?? null,
  };
}
