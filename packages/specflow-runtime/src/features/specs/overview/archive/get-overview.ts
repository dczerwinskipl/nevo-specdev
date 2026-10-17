import type {
  ArchivedSpecOverviewItem,
  ArchiveSpecsOverview,
} from '@nevo/specflow-contracts/specs/overview';

import type { RequestAuthorization } from '../../../auth';
import type { ArchivedSpecRecord } from '../repository/model';
import { canViewSpec, filterAuthorizedSpecs } from '../filter-authorized-specs';
import type { SpecsOverviewRepository } from '../repository/read-repository';

export interface GetArchiveOverviewDependencies {
  readonly authorization: RequestAuthorization;
  readonly repository: SpecsOverviewRepository;
}

export async function getArchiveOverview(
  dependencies: GetArchiveOverviewDependencies,
): Promise<ArchiveSpecsOverview> {
  const snapshot = await dependencies.repository.readArchive((specId) =>
    canViewSpec(dependencies.authorization, specId),
  );
  const items = filterAuthorizedSpecs(dependencies.authorization, snapshot.items).map(
    toOverviewItem,
  );

  return {
    revision: snapshot.revision,
    collection: 'archive',
    items,
  };
}

function toOverviewItem(spec: ArchivedSpecRecord): ArchivedSpecOverviewItem {
  return {
    id: spec.id,
    title: spec.title,
    ...(spec.key === undefined ? {} : { key: spec.key }),
    ...(spec.pullRequests === undefined ? {} : { pullRequests: [...spec.pullRequests] }),
    ...(spec.tags === undefined ? {} : { tags: [...spec.tags] }),
    updatedAt: spec.updatedAt,
    progress: spec.progress,
    ...(spec.completedAt === undefined ? {} : { completedAt: spec.completedAt }),
    ...(spec.archivedAt === undefined ? {} : { archivedAt: spec.archivedAt }),
  };
}
