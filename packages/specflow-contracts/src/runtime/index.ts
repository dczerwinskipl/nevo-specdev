import { Type, type Static } from 'typebox';

export const RuntimeInfoResponseSchema = Type.Object({
  dataMode: Type.Union([Type.Literal('project'), Type.Literal('demo')]),
});
export type RuntimeInfoResponse = Static<typeof RuntimeInfoResponseSchema>;
