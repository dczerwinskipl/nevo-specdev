import { Type, type Static } from 'typebox';

import { SpecOverviewItemSchema } from './common';

export const CurrentSpecAttentionReasonSchema = Type.Union([
  Type.Literal('input'),
  Type.Literal('decision'),
  Type.Literal('review'),
  Type.Literal('blocked'),
  Type.Literal('approval'),
]);
export type CurrentSpecAttentionReason = Static<typeof CurrentSpecAttentionReasonSchema>;

export const CurrentSpecSignalKindSchema = Type.Union([
  Type.Literal('attention'),
  Type.Literal('ready'),
  Type.Literal('working'),
  Type.Literal('issue'),
  Type.Literal('quiet'),
]);
export type CurrentSpecSignalKind = Static<typeof CurrentSpecSignalKindSchema>;

export const CurrentSpecTargetSchema = Type.Union([
  Type.Object({ kind: Type.Literal('specification'), specId: Type.String() }),
  Type.Object({ kind: Type.Literal('task'), specId: Type.String(), taskId: Type.String() }),
  Type.Object({ kind: Type.Literal('session'), specId: Type.String(), sessionId: Type.String() }),
]);
export type CurrentSpecTarget = Static<typeof CurrentSpecTargetSchema>;

export const CurrentSpecSignalSchema = Type.Object({
  id: Type.String(),
  kind: CurrentSpecSignalKindSchema,
  label: Type.String(),
  reason: Type.Optional(Type.String()),
  attentionReason: Type.Optional(CurrentSpecAttentionReasonSchema),
  count: Type.Optional(Type.Integer({ minimum: 1 })),
  priority: Type.Number(),
  target: CurrentSpecTargetSchema,
});
export type CurrentSpecSignal = Static<typeof CurrentSpecSignalSchema>;

export const CurrentSpecSectionIdSchema = Type.Union([
  Type.Literal('requires-attention'),
  Type.Literal('active'),
  Type.Literal('ready'),
  Type.Literal('draft'),
  Type.Literal('unknown'),
]);
export type CurrentSpecSectionId = Static<typeof CurrentSpecSectionIdSchema>;

export const CurrentSpecClassificationSchema = Type.Union([
  Type.Object({
    section: Type.Literal('requires-attention'),
    reason: Type.Optional(CurrentSpecAttentionReasonSchema),
    count: Type.Optional(Type.Integer({ minimum: 1 })),
  }),
  Type.Object({ section: Type.Literal('active') }),
  Type.Object({ section: Type.Literal('ready') }),
  Type.Object({ section: Type.Literal('draft') }),
  Type.Object({ section: Type.Literal('unknown') }),
]);
export type CurrentSpecClassification = Static<typeof CurrentSpecClassificationSchema>;

export const CurrentSpecOverviewItemSchema = Type.Object(
  {
    ...SpecOverviewItemSchema.properties,
    classification: CurrentSpecClassificationSchema,
    signals: Type.Union([Type.Array(CurrentSpecSignalSchema), Type.Null()]),
    currentExecutions: Type.Union([
      Type.Array(
        Type.Object({
          sessionId: Type.String(),
          agentRole: Type.String(),
          taskIds: Type.Array(Type.String()),
        }),
      ),
      Type.Null(),
    ]),
  },
  { additionalProperties: false },
);
export type CurrentSpecOverviewItem = Static<typeof CurrentSpecOverviewItemSchema>;

export const CurrentSpecsOverviewSchema = Type.Object(
  {
    revision: Type.String(),
    collection: Type.Literal('current'),
    sections: Type.Array(CurrentSpecSectionIdSchema),
    items: Type.Array(CurrentSpecOverviewItemSchema),
  },
  { additionalProperties: false },
);
export type CurrentSpecsOverview = Static<typeof CurrentSpecsOverviewSchema>;
