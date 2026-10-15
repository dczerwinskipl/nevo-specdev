import { Type, type Static } from 'typebox';

export const SpecsCollectionSchema = Type.Union([Type.Literal('current'), Type.Literal('archive')]);
export type SpecsCollection = Static<typeof SpecsCollectionSchema>;

export const SpecOverviewItemSchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  key: Type.Optional(Type.String()),
  pullRequests: Type.Optional(
    Type.Array(Type.Object({ number: Type.Integer(), url: Type.String() })),
  ),
  tags: Type.Optional(Type.Array(Type.String())),
  updatedAt: Type.String(),
  // Null means progress was not projected, not zero completed tasks.
  progress: Type.Union([
    Type.Object({
      completed: Type.Integer({ minimum: 0 }),
      total: Type.Integer({ minimum: 0 }),
    }),
    Type.Null(),
  ]),
});
export type SpecOverviewItem = Static<typeof SpecOverviewItemSchema>;

export const SpecsOverviewQuerySchema = Type.Object(
  { collection: Type.Optional(SpecsCollectionSchema) },
  { additionalProperties: false },
);
