import { Type, type Static } from 'typebox';

export { SpecsCollectionSchema, SpecsOverviewQuerySchema, SpecOverviewItemSchema } from './common';
export { SpecsOverviewReadErrorSchema } from './errors';
export type { SpecsOverviewReadError } from './errors';
export type { SpecsCollection, SpecOverviewItem } from './common';

export {
  CurrentSpecAttentionReasonSchema,
  CurrentSpecClassificationSchema,
  CurrentSpecOverviewItemSchema,
  CurrentSpecSectionIdSchema,
  CurrentSpecSignalKindSchema,
  CurrentSpecSignalSchema,
  CurrentSpecTargetSchema,
  CurrentSpecsOverviewSchema,
} from './current';
export type {
  CurrentSpecAttentionReason,
  CurrentSpecClassification,
  CurrentSpecOverviewItem,
  CurrentSpecSectionId,
  CurrentSpecSignalKind,
  CurrentSpecSignal,
  CurrentSpecTarget,
  CurrentSpecsOverview,
} from './current';

export { ArchivedSpecOverviewItemSchema, ArchiveSpecsOverviewSchema } from './archive';
export type { ArchivedSpecOverviewItem, ArchiveSpecsOverview } from './archive';

import { CurrentSpecsOverviewSchema } from './current';
import { ArchiveSpecsOverviewSchema } from './archive';

export const SpecsOverviewSchema = Type.Union([
  CurrentSpecsOverviewSchema,
  ArchiveSpecsOverviewSchema,
]);
export type SpecsOverview = Static<typeof SpecsOverviewSchema>;
