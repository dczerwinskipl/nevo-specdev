import { Type, type Static } from 'typebox';

const IdSchema = Type.String({
  minLength: 1,
  maxLength: 200,
  pattern: '^[a-zA-Z0-9][a-zA-Z0-9._-]*$',
});
export const SpecificationWorkspaceParamsSchema = Type.Object(
  { specId: IdSchema },
  { additionalProperties: false },
);
export const SpecificationDocumentParamsSchema = Type.Object(
  { specId: IdSchema, documentId: IdSchema },
  { additionalProperties: false },
);
export const SpecificationTaskParamsSchema = Type.Object(
  { specId: IdSchema, taskId: IdSchema },
  { additionalProperties: false },
);

export const ReadSectionSchema = <T extends ReturnType<typeof Type.Object>>(data: T) =>
  Type.Union([
    Type.Object({ state: Type.Literal('available'), data }),
    Type.Object({
      state: Type.Literal('unavailable'),
      reason: Type.Union([Type.Literal('not_implemented'), Type.Literal('source_unavailable')]),
    }),
    Type.Object({ state: Type.Literal('forbidden') }),
  ]);

const TaskStatusSchema = Type.Object({
  id: Type.String(),
  label: Type.String(),
  lifecycle: Type.Union([
    Type.Literal('pending'),
    Type.Literal('in_progress'),
    Type.Literal('completed'),
    Type.Literal('blocked'),
  ]),
});
export const WorkspaceTaskSchema = Type.Object({
  id: IdSchema,
  title: Type.String(),
  status: TaskStatusSchema,
});
export const WorkspaceTaskGroupSchema = Type.Object({
  id: IdSchema,
  name: Type.String(),
  tasks: Type.Array(WorkspaceTaskSchema),
});
export const WorkspaceDocumentSchema = Type.Object({
  id: IdSchema,
  title: Type.String(),
  kind: Type.String(),
  summary: Type.Optional(Type.String()),
});
export const WorkspaceSessionSchema = Type.Object({
  id: IdSchema,
  title: Type.String(),
  taskIds: Type.Array(IdSchema),
  status: Type.Union([
    Type.Literal('active'),
    Type.Literal('attention'),
    Type.Literal('quiet'),
    Type.Literal('unknown'),
  ]),
});
export const WorkspaceAttentionSchema = Type.Object({
  id: IdSchema,
  kind: Type.Union([
    Type.Literal('task'),
    Type.Literal('session'),
    Type.Literal('git'),
    Type.Literal('specification'),
  ]),
  title: Type.String(),
  reason: Type.String(),
  targetId: Type.Optional(IdSchema),
  priority: Type.Optional(
    Type.Union([Type.Literal('critical'), Type.Literal('high'), Type.Literal('normal')]),
  ),
});
const ActivitySchema = Type.Object({
  id: IdSchema,
  occurredAt: Type.String(),
  kind: Type.Union([
    Type.Literal('task'),
    Type.Literal('session'),
    Type.Literal('doc'),
    Type.Literal('info'),
  ]),
  title: Type.String(),
  description: Type.String(),
  targetId: Type.Optional(IdSchema),
  /** Session provenance for generic events carrying Session data. */
  relatedSessionId: Type.Optional(IdSchema),
});
const RepoSchema = Type.Object({
  repositoryName: Type.Optional(Type.String()),
  branch: Type.Optional(Type.String()),
  baseBranch: Type.Optional(Type.String()),
  uncommittedCount: Type.Optional(Type.Integer({ minimum: 0 })),
  attention: Type.Array(WorkspaceAttentionSchema),
});
const ChangesSchema = Type.Object({
  base: Type.Array(Type.String()),
  uncommitted: Type.Array(Type.String()),
  mr: Type.Array(Type.String()),
});
const TaskCollectionSchema = Type.Object({
  groups: Type.Array(WorkspaceTaskGroupSchema),
  completed: Type.Integer({ minimum: 0 }),
  total: Type.Integer({ minimum: 0 }),
  attention: Type.Array(WorkspaceAttentionSchema),
});
const DocumentCollectionSchema = Type.Object({ items: Type.Array(WorkspaceDocumentSchema) });
const SessionCollectionSchema = Type.Object({
  items: Type.Array(WorkspaceSessionSchema),
  attention: Type.Array(WorkspaceAttentionSchema),
});
const ActivityCollectionSchema = Type.Object({ items: Type.Array(ActivitySchema) });
const ActionSchema = Type.Object({
  available: Type.Boolean(),
  reason: Type.Optional(Type.String()),
});
export const SpecificationWorkspaceResponseSchema = Type.Object({
  revision: Type.String(),
  recommendedSessionId: Type.Optional(IdSchema),
  specification: Type.Object({
    id: IdSchema,
    title: Type.String(),
    summary: Type.String(),
    preparationState: Type.Union([
      Type.Literal('empty'),
      Type.Literal('preparing'),
      Type.Literal('prepared'),
    ]),
    attention: Type.Array(WorkspaceAttentionSchema),
  }),
  sections: Type.Object({
    tasks: ReadSectionSchema(TaskCollectionSchema),
    documents: ReadSectionSchema(DocumentCollectionSchema),
    sessions: ReadSectionSchema(SessionCollectionSchema),
    activity: ReadSectionSchema(ActivityCollectionSchema),
    repository: ReadSectionSchema(RepoSchema),
    changes: ReadSectionSchema(ChangesSchema),
  }),
  actions: Type.Object({
    executeTasks: ActionSchema,
    startSession: ActionSchema,
  }),
});
export const SpecificationDocumentResponseSchema = Type.Object({
  id: IdSchema,
  title: Type.String(),
  content: Type.String(),
  revision: Type.String(),
});
export const SpecificationTaskResponseSchema = Type.Object({
  task: WorkspaceTaskSchema,
  purpose: Type.Optional(Type.String()),
  acceptanceCriteria: Type.Array(Type.String()),
  workflow: Type.Optional(Type.String()),
});
export const SpecificationReadErrorSchema = Type.Object({
  error: Type.Union([
    Type.Literal('specification_not_found'),
    Type.Literal('specification_document_not_found'),
    Type.Literal('specification_task_not_found'),
    Type.Literal('specification_source_unavailable'),
  ]),
});
export type SpecificationWorkspaceResponse = Static<typeof SpecificationWorkspaceResponseSchema>;
export type SpecificationDocumentResponse = Static<typeof SpecificationDocumentResponseSchema>;
export type SpecificationTaskResponse = Static<typeof SpecificationTaskResponseSchema>;
export type WorkspaceTask = Static<typeof WorkspaceTaskSchema>;
export type WorkspaceTaskGroup = Static<typeof WorkspaceTaskGroupSchema>;
export type WorkspaceDocument = Static<typeof WorkspaceDocumentSchema>;
export type WorkspaceSession = Static<typeof WorkspaceSessionSchema>;
export type WorkspaceAttention = Static<typeof WorkspaceAttentionSchema>;
