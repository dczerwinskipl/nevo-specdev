import { Type, type Static } from 'typebox';
import { TaskSnapshotSchema } from './task-read';
export * from './task-read';
export const TaskReadErrorSchema = Type.Object({
  error: Type.Union([
    Type.Literal('specification_task_not_found'),
    Type.Literal('specification_source_unavailable'),
  ]),
});
const IdSchema = Type.String({
  minLength: 1,
  maxLength: 200,
  pattern: '^[a-zA-Z0-9][a-zA-Z0-9._-]*$',
});
export const SpecificationTaskParamsSchema = Type.Object(
  { specId: IdSchema, taskId: IdSchema },
  { additionalProperties: false },
);

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
export const SpecificationTaskResponseSchema = Type.Object({
  task: WorkspaceTaskSchema,
  purpose: Type.Optional(Type.String()),
  acceptanceCriteria: Type.Array(Type.String()),
  workflow: Type.Optional(Type.String()),
  snapshot: Type.Optional(TaskSnapshotSchema),
});
export type SpecificationTaskResponse = Static<typeof SpecificationTaskResponseSchema>;
export type WorkspaceTask = Static<typeof WorkspaceTaskSchema>;
