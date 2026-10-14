import { Type, type Static } from 'typebox';

const UuidSchema = Type.String({
  pattern:
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
});

export const ExistingSpecTargetSchema = Type.Object(
  { kind: Type.Literal('existing'), workspaceId: UuidSchema },
  { additionalProperties: false },
);
export const NewSpecWorktreeTargetSchema = Type.Object(
  {
    kind: Type.Literal('new-worktree'),
    baseRef: Type.Optional(Type.String({ minLength: 1 })),
    branch: Type.Optional(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

export const CreateSpecRequestSchema = Type.Object(
  {
    title: Type.String({ minLength: 1, maxLength: 512 }),
    goal: Type.Optional(Type.String({ maxLength: 4000 })),
    operationId: Type.Optional(UuidSchema),
    target: Type.Optional(Type.Union([ExistingSpecTargetSchema, NewSpecWorktreeTargetSchema])),
  },
  { additionalProperties: false },
);
export type CreateSpecRequest = Static<typeof CreateSpecRequestSchema>;

export const CreatedSpecSchema = Type.Object(
  {
    operationId: UuidSchema,
    specId: UuidSchema,
    slug: Type.String(),
    workspaceId: UuidSchema,
    workspaceRoot: Type.String(),
    relativeManifestPath: Type.String(),
  },
  { additionalProperties: false },
);
export type CreatedSpec = Static<typeof CreatedSpecSchema>;

export const CreateSpecErrorSchema = Type.Object(
  { error: Type.String(), code: Type.String() },
  { additionalProperties: false },
);
