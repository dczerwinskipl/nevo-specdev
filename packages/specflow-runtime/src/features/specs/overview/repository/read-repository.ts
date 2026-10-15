import type { ArchivedSpecRecord, CurrentSpecRecord } from './model';

export interface CurrentSpecsSnapshot {
  readonly revision: string;
  readonly items: readonly CurrentSpecRecord[];
}

export interface ArchiveSpecsSnapshot {
  readonly revision: string;
  readonly items: readonly ArchivedSpecRecord[];
}

export interface SpecsOverviewRepository {
  readCurrent(isVisibleSpec?: (specId: string) => boolean): Promise<CurrentSpecsSnapshot>;
  readArchive(isVisibleSpec?: (specId: string) => boolean): Promise<ArchiveSpecsSnapshot>;
}
