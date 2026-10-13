import { Type, type Static } from 'typebox';
export const DocumentReadErrorSchema = Type.Object({
  error: Type.Union([
    Type.Literal('specification_document_not_found'),
    Type.Literal('specification_source_unavailable'),
  ]),
});
const IdSchema = Type.String({
  minLength: 1,
  maxLength: 200,
  pattern: '^[a-zA-Z0-9][a-zA-Z0-9._-]*$',
});
export const SpecificationDocumentParamsSchema = Type.Object(
  { specId: IdSchema, documentId: IdSchema },
  { additionalProperties: false },
);
export const SpecificationDocumentResponseSchema = Type.Object({
  id: IdSchema,
  title: Type.String(),
  content: Type.String(),
  revision: Type.String(),
});
export const DocumentQuerySchema = Type.Object(
  { revision: Type.Optional(Type.String({ minLength: 1, maxLength: 1000 })) },
  { additionalProperties: false },
);
export const DocumentRevisionUnavailableSchema = Type.Object({
  error: Type.Literal('document_revision_unavailable'),
});
export type SpecificationDocumentResponse = Static<typeof SpecificationDocumentResponseSchema>;
