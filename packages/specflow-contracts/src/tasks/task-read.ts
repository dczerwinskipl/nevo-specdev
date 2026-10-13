import { Type, type Static, type TSchema } from 'typebox';

const Id = Type.String({ minLength: 1, maxLength: 200, pattern: '^[a-zA-Z0-9][a-zA-Z0-9._-]*$' });
const Text = Type.String();
const NullableText = Type.Union([Text, Type.Null()]);
const section = <T extends TSchema>(data: T) =>
  Type.Union([
    Type.Object({ state: Type.Literal('available'), data }),
    Type.Object({
      state: Type.Literal('unavailable'),
      reason: Type.Union([Type.Literal('not_implemented'), Type.Literal('source_unavailable')]),
    }),
    Type.Object({ state: Type.Literal('forbidden') }),
  ]);
const AttemptKey = Type.Object({
  specId: Id,
  taskId: Id,
  stepId: Id,
  attempt: Type.Integer({ minimum: 1 }),
});
const Step = Type.Object({
  id: Id,
  executor: Type.Union([Type.Literal('agent'), Type.Literal('human')]),
  purpose: NullableText,
  expectedWork: Type.Union([Type.Object({ summary: Text }), Type.Null()]),
  hints: Type.Array(
    Type.Object({
      kind: Type.Union([Type.Literal('doc'), Type.Literal('skill'), Type.Literal('file')]),
      ref: Text,
    }),
  ),
});
const Target = Type.Union([
  Type.Object({ kind: Type.Literal('task'), specId: Id, taskId: Id }),
  Type.Object({
    kind: Type.Literal('requirement'),
    specId: Id,
    taskId: Id,
    requirementId: Id,
    revision: Text,
  }),
  Type.Object({ kind: Type.Literal('session'), sessionId: Id }),
  Type.Object({ kind: Type.Literal('document'), specId: Id, documentId: Id, revision: Text }),
  Type.Object({ kind: Type.Literal('changes'), specId: Id, comparisonId: Id, revision: Text }),
  Type.Object({ kind: Type.Literal('report'), specId: Id, reportId: Id, revision: Text }),
]);
const Link = Type.Union([
  Type.Object({ state: Type.Literal('available'), target: Target }),
  Type.Object({
    state: Type.Literal('unavailable'),
    reason: Type.Union([
      Type.Literal('not_implemented'),
      Type.Literal('source_unavailable'),
      Type.Literal('not_found'),
    ]),
  }),
  Type.Object({ state: Type.Literal('forbidden') }),
]);
const TransitionTarget = Type.Union([
  Type.Object({ kind: Type.Literal('step'), step: Step }),
  Type.Object({
    kind: Type.Literal('terminal'),
    status: Text,
    outcome: Type.Union([Type.Literal('success'), Type.Literal('failure')]),
  }),
]);
const Transition = Type.Object({
  id: Id,
  result: Type.Optional(Text),
  label: Type.Optional(Text),
  feedbackRequired: Type.Boolean(),
  target: TransitionTarget,
});
const Position = Type.Union([
  Type.Object({ state: Type.Literal('not_started'), next: Type.Union([Step, Type.Null()]) }),
  Type.Object({ state: Type.Literal('active'), key: AttemptKey, step: Step, semanticStatus: Text }),
  Type.Object({
    state: Type.Literal('checkpoint'),
    completed: AttemptKey,
    next: Step,
    nextAttempt: Type.Null(),
  }),
  Type.Object({
    state: Type.Literal('terminal'),
    completed: AttemptKey,
    status: Text,
    outcome: Type.Union([Type.Literal('success'), Type.Literal('failure')]),
  }),
]);
export const TaskResourceSchema = Type.Object({
  id: Id,
  title: Text,
  kind: Text,
  relation: Type.Union([
    Type.Literal('input'),
    Type.Literal('output'),
    Type.Literal('current_execution'),
    Type.Literal('previous_execution'),
    Type.Literal('context'),
  ]),
  producedFor: Type.Array(AttemptKey),
  neededFor: Type.Array(
    Type.Object({ stepId: Id, attempt: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]) }),
  ),
  origin: Type.Object({
    kind: Type.Union([
      Type.Literal('hint'),
      Type.Literal('completion'),
      Type.Literal('execution'),
      Type.Literal('explicit_association'),
    ]),
    sourceId: Id,
  }),
  link: Link,
});
const HumanRequirement = Type.Object({
  id: Id,
  definitionRevision: Text,
  source: Type.Union([
    Type.Object({
      kind: Type.Literal('human-step'),
      stepId: Id,
      relation: Type.Union([Type.Literal('current'), Type.Literal('next-ready')]),
    }),
    Type.Object({
      kind: Type.Literal('human-gate'),
      gateId: NullableText,
      phase: Type.Union([Type.Literal('entry'), Type.Literal('exit')]),
      role: Text,
      scope: Type.Union([Type.Literal('task'), Type.Literal('step'), Type.Literal('change')]),
      targetId: Id,
    }),
  ]),
  key: Type.Union([AttemptKey, Type.Null()]),
  title: Text,
  instruction: NullableText,
  state: Type.Union([Type.Literal('pending'), Type.Literal('passed'), Type.Literal('unavailable')]),
  inspectionProblem: Type.Optional(Text),
  actions: Type.Array(
    Type.Object({ result: Type.Optional(Text), label: Text, feedbackRequired: Type.Boolean() }),
  ),
  evidence: Type.Array(Type.Object({ title: Text, link: Link })),
});
const PageRef = Type.Object({
  token: Text,
  initialLimit: Type.Integer({ minimum: 1, maximum: 50 }),
});
const page = <T extends TSchema>(item: T) =>
  Type.Object({
    token: Text,
    items: Type.Array(item),
    nextCursor: NullableText,
    coverage: Type.Union([Type.Literal('complete'), Type.Literal('partial')]),
  });
export const TaskHistoryEntrySchema = Type.Object({
  id: Id,
  key: AttemptKey,
  step: Step,
  startedAt: NullableText,
  completedAt: NullableText,
  result: NullableText,
  transitionedTo: Type.Union([TransitionTarget, Type.Null()]),
  feedback: NullableText,
  resources: Type.Array(TaskResourceSchema),
  provenance: Type.Array(
    Type.Object({
      source: Type.Union([
        Type.Literal('workflow_history'),
        Type.Literal('operation_record'),
        Type.Literal('activity'),
      ]),
      sourceId: Text,
    }),
  ),
});
export const TaskResourcePageSchema = page(TaskResourceSchema);
export const TaskHistoryPageSchema = page(TaskHistoryEntrySchema);
export const TaskPageQuerySchema = Type.Object(
  {
    token: Type.String({ minLength: 1, maxLength: 1000 }),
    cursor: Type.Optional(Type.String({ maxLength: 1000 })),
    limit: Type.Optional(Type.String({ pattern: '^(?:[1-9]|[1-4][0-9]|50)$' })),
  },
  { additionalProperties: false },
);
export const TaskSnapshotExpiredSchema = Type.Object({
  error: Type.Literal('task_snapshot_expired'),
});
const Descriptor = Type.Object({ id: Id, label: Text });
/** Additive Task detail. Project adapters may omit this until they implement the reader. */
export const TaskSnapshotSchema = Type.Object({
  revision: Text,
  specification: Type.Object({ id: Id, title: Text }),
  taskType: Type.Union([Descriptor, Type.Null()]),
  group: Type.Union([Descriptor, Type.Null()]),
  summary: NullableText,
  sections: Type.Object({
    work: section(
      Type.Object({
        definition: Type.Object({
          id: Id,
          title: Text,
          description: NullableText,
          revision: Text,
          steps: Type.Array(Type.Object({ step: Step, transitions: Type.Array(Transition) })),
        }),
        position: Position,
        transitions: Type.Array(Transition),
        blockers: Type.Array(
          Type.Object({
            code: Text,
            message: Text,
            operation: Type.Union([Type.Literal('start'), Type.Literal('finish')]),
          }),
        ),
        previousFeedback: Type.Union([
          Type.Object({ key: AttemptKey, result: NullableText, text: Text }),
          Type.Null(),
        ]),
      }),
    ),
    humanRequirements: section(
      Type.Object({
        items: Type.Array(HumanRequirement),
        pendingCount: Type.Integer({ minimum: 0 }),
      }),
    ),
    resources: section(
      Type.Object({
        recommended: Type.Array(TaskResourceSchema, { maxItems: 3 }),
        visibleTotal: Type.Integer({ minimum: 0 }),
        page: Type.Union([PageRef, Type.Null()]),
      }),
    ),
    document: section(
      Type.Union([
        Type.Object({ id: Id, revision: Text, hasMore: Type.Optional(Type.Boolean()) }),
        Type.Null(),
      ]),
    ),
    dependencies: section(
      Type.Object({ items: Type.Array(Type.Object({ taskId: Id, title: Text, link: Link })) }),
    ),
    recovery: section(
      Type.Union([Type.Object({ id: Id, state: Text, summary: Text, link: Link }), Type.Null()]),
    ),
    history: section(PageRef),
  }),
});
export type TaskSnapshot = Static<typeof TaskSnapshotSchema>;
export type TaskResource = Static<typeof TaskResourceSchema>;
export type TaskResourcePage = Static<typeof TaskResourcePageSchema>;
export type TaskHistoryPage = Static<typeof TaskHistoryPageSchema>;
export type TaskTarget = Static<typeof Target>;
export type TaskLink = Static<typeof Link>;
export type TaskHumanRequirement = Static<typeof HumanRequirement>;
