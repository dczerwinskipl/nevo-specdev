import { Type, type Static } from 'typebox';

export const SpecsOverviewReadErrorSchema = Type.Object(
  {
    error: Type.String(),
    code: Type.Union([
      Type.Literal('ENGINE_UNAVAILABLE'),
      Type.Literal('SPEC_WORKSPACE_UNAVAILABLE'),
      Type.Literal('SPEC_MANIFEST_MISSING'),
      Type.Literal('SPEC_SOURCE_UNAVAILABLE'),
    ]),
  },
  { additionalProperties: false },
);
export type SpecsOverviewReadError = Static<typeof SpecsOverviewReadErrorSchema>;
