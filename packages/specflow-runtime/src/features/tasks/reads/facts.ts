/** Runtime adapter facts. These are not an Engine API or an authorized HTTP snapshot. */
export interface TaskIdentity {
  projectId: string;
  workspaceId: string;
  specId: string;
  taskId: string;
}
export interface AttemptIdentity {
  specId: string;
  taskId: string;
  stepId: string;
  attempt: number;
}
export interface StepFacts {
  id: string;
  executor: 'agent' | 'human';
  purpose: string | null;
  expectedWork: { summary: string } | null;
  hints: { kind: 'doc' | 'skill' | 'file'; ref: string }[];
}
export type TransitionDestination =
  | { kind: 'step'; step: StepFacts }
  | { kind: 'terminal'; status: string; outcome: 'success' | 'failure' };
export interface TransitionFacts {
  id: string;
  result?: string;
  label?: string;
  feedbackRequired: boolean;
  target: TransitionDestination;
}
export type ReferenceTarget =
  | { kind: 'task'; specId: string; taskId: string }
  | { kind: 'requirement'; specId: string; taskId: string; requirementId: string; revision: string }
  | { kind: 'session'; sessionId: string }
  | { kind: 'document'; specId: string; documentId: string; revision: string }
  | { kind: 'changes'; specId: string; comparisonId: string; revision: string }
  | { kind: 'report'; specId: string; reportId: string; revision: string };
export type ReferenceFacts =
  | { state: 'available'; target: ReferenceTarget }
  | { state: 'unavailable'; reason: 'not_implemented' | 'source_unavailable' | 'not_found' }
  | { state: 'forbidden' };
export type Availability<T> =
  | { state: 'available'; data: T }
  | { state: 'unavailable'; reason: 'not_implemented' | 'source_unavailable' }
  | { state: 'forbidden' };
export interface ResourceFacts {
  id: string;
  title: string;
  kind: string;
  relation: 'input' | 'output' | 'current_execution' | 'previous_execution' | 'context';
  producedFor: AttemptIdentity[];
  neededFor: { stepId: string; attempt: number | null }[];
  origin: { kind: 'hint' | 'completion' | 'execution' | 'explicit_association'; sourceId: string };
  link: ReferenceFacts;
}
export interface RequirementFacts {
  id: string;
  definitionRevision: string;
  source:
    | { kind: 'human-step'; stepId: string; relation: 'current' | 'next-ready' }
    | {
        kind: 'human-gate';
        gateId: string | null;
        phase: 'entry' | 'exit';
        role: string;
        scope: 'task' | 'step' | 'change';
        targetId: string;
      };
  key: AttemptIdentity | null;
  title: string;
  instruction: string | null;
  state: 'pending' | 'passed' | 'unavailable';
  inspectionProblem?: string;
  actions: { result?: string; label: string; feedbackRequired: boolean }[];
  evidence: { title: string; link: ReferenceFacts }[];
}
export interface ExecutionFacts {
  identity: TaskIdentity;
  definitionVersion: string;
  version: string;
  workflow: {
    definition: {
      id: string;
      title: string;
      description: string | null;
      revision: string;
      steps: { step: StepFacts; transitions: TransitionFacts[] }[];
    };
    position:
      | { state: 'not_started'; next: StepFacts | null }
      | { state: 'active'; key: AttemptIdentity; step: StepFacts; semanticStatus: string }
      | { state: 'checkpoint'; completed: AttemptIdentity; next: StepFacts; nextAttempt: null }
      | {
          state: 'terminal';
          completed: AttemptIdentity;
          status: string;
          outcome: 'success' | 'failure';
        };
    transitions: TransitionFacts[];
    blockers: { code: string; message: string; operation: 'start' | 'finish' }[];
    previousFeedback: { key: AttemptIdentity; result: string | null; text: string } | null;
  };
  requirements: RequirementFacts[];
  pendingCount: number;
  recovery: { id: string; state: string; summary: string; link: ReferenceFacts } | null;
}
export interface TaskDefinitionFacts {
  identity: TaskIdentity;
  version: string;
  specificationTitle: string;
  task: {
    id: string;
    title: string;
    status: {
      id: string;
      label: string;
      lifecycle: 'pending' | 'in_progress' | 'completed' | 'blocked';
    };
  };
  purpose?: string;
  acceptanceCriteria: string[];
  workflow?: string;
  summary: string | null;
  group: { id: string; label: string } | null;
  taskType: { id: string; label: string } | null;
  document: Availability<{ id: string; revision: string } | null>;
  dependencies: { taskId: string; title: string; link: ReferenceFacts }[];
}
export interface HistoryFacts {
  id: string;
  key: AttemptIdentity;
  step: StepFacts;
  startedAt: string | null;
  completedAt: string | null;
  result: string | null;
  transitionedTo: TransitionDestination | null;
  feedback: string | null;
  resources: ResourceFacts[];
  provenance: { source: 'workflow_history' | 'operation_record' | 'activity'; sourceId: string }[];
}
export interface SourceRead {
  identity: TaskIdentity;
  handle: string;
  version: string;
  coverage: 'complete' | 'partial';
}
export interface SourcePage<T> {
  identity: TaskIdentity;
  version: string;
  items: T[];
  next: string | null;
  coverage: 'complete' | 'partial';
}
export type ReferenceVisibility = (link: ReferenceFacts) => Promise<boolean>;
export interface DefinitionSource {
  resolve(specId: string, taskId: string): Promise<TaskDefinitionFacts | null>;
}
export interface ExecutionSource {
  inspect(identity: TaskIdentity, definitionVersion: string): Promise<ExecutionFacts | null>;
}
export interface HistorySource {
  open(identity: TaskIdentity): Promise<SourceRead | null>;
  read(
    identity: TaskIdentity,
    handle: string,
    continuation: string | null,
    limit: number,
  ): Promise<SourcePage<HistoryFacts> | null>;
}
export interface ResourceSource {
  open(
    identity: TaskIdentity,
    visible: ReferenceVisibility,
  ): Promise<(SourceRead & { visibleTotal: number }) | null>;
  read(
    identity: TaskIdentity,
    handle: string,
    continuation: string | null,
    limit: number,
    visible: ReferenceVisibility,
  ): Promise<SourcePage<ResourceFacts> | null>;
}
export function sameTask(a: TaskIdentity, b: TaskIdentity) {
  return (
    a.projectId === b.projectId &&
    a.workspaceId === b.workspaceId &&
    a.specId === b.specId &&
    a.taskId === b.taskId
  );
}
