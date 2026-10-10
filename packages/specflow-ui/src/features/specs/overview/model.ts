import type { StatusTone } from '@nevo/ui';

import type {
  CurrentSpecSectionId,
  SpecsCollection,
  SpecsOverview,
} from '@nevo/specflow-contracts/specs/overview';

export type {
  ArchivedSpecOverviewItem,
  ArchiveSpecsOverview,
  CurrentSpecClassification,
  CurrentSpecOverviewItem,
  CurrentSpecSectionId,
  CurrentSpecsOverview,
  CurrentSpecAttentionReason,
  SpecOverviewItem,
  CurrentSpecSignal,
  CurrentSpecSignalKind,
  CurrentSpecTarget,
  SpecsCollection,
  SpecsOverview,
} from '@nevo/specflow-contracts/specs/overview';

export interface SpecsOverviewState {
  readonly collection: SpecsCollection;
  readonly projection?: SpecsOverview;
  readonly loading: boolean;
  readonly refreshing: boolean;
  readonly error: boolean;
  readonly errorStatus?: number;
}

export const sectionTone: Record<CurrentSpecSectionId, StatusTone> = {
  'requires-attention': 'attention',
  active: 'info',
  ready: 'success',
  draft: 'neutral',
};

export const sectionTranslationKey = {
  'requires-attention': 'specifications.sections.requiresAttention',
  active: 'specifications.sections.active',
  ready: 'specifications.sections.ready',
  draft: 'specifications.sections.draft',
} as const satisfies Record<CurrentSpecSectionId, string>;
