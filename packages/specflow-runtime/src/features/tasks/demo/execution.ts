import type {
  TaskDefinitionFacts,
  ExecutionFacts,
  ResourceFacts,
  HistoryFacts,
  RequirementFacts,
} from '../reads/facts';
export function demoExecutionFacts(
  specId: string,
  task: TaskDefinitionFacts['task'],
): ExecutionFacts {
  const key = { specId, taskId: task.id, stepId: 'manual-tests', attempt: 1 };
  const step = {
    id: 'manual-tests',
    executor: 'human' as const,
    purpose: 'Check return navigation, session expiry and two browser tabs.',
    expectedWork: { summary: 'Manual verification of session behaviour' },
    hints: [],
  };
  const buildStep = {
    id: 'build',
    executor: 'agent' as const,
    purpose: 'Implement the change.',
    expectedWork: { summary: 'Implement session behaviour' },
    hints: [],
  };
  const transitions = [
    {
      id: 'passed',
      label: 'Scenarios passed',
      feedbackRequired: false,
      target: { kind: 'terminal' as const, status: 'completed', outcome: 'success' as const },
    },
    {
      id: 'returned',
      label: 'Return for correction',
      feedbackRequired: true,
      target: { kind: 'step' as const, step: buildStep },
    },
  ];
  const terminal = task.status.lifecycle === 'completed';
  const active = task.status.lifecycle === 'in_progress' || task.status.lifecycle === 'blocked';
  const requirements: { items: RequirementFacts[]; pendingCount: number } = {
    pendingCount: active ? 5 : 0,
    items: active
      ? [
          {
            id: 'manual-tests',
            definitionRevision: 'demo-definition-1',
            source: { kind: 'human-step', stepId: step.id, relation: 'current' },
            key,
            title: step.expectedWork.summary,
            instruction: step.purpose,
            state: 'pending',
            actions: [{ label: 'Scenarios passed', feedbackRequired: false }],
            evidence: [],
          },
          ...Array.from({ length: 4 }, (_, i) => ({
            id: 'gate-' + i,
            definitionRevision: 'demo-definition-1',
            source: {
              kind: 'human-gate' as const,
              gateId: 'gate-' + i,
              phase: 'exit' as const,
              role: 'owner',
              scope: 'step' as const,
              targetId: task.id,
            },
            key,
            title: [
              'Verify return navigation',
              'Verify expiry',
              'Verify two browser tabs',
              'Owner sign-off',
            ][i]!,
            instruction: null,
            state: 'pending' as const,
            actions: [],
            evidence: [],
          })),
        ]
      : [],
  };
  return {
    identity: { projectId: 'demo-project', workspaceId: 'demo-workspace', specId, taskId: task.id },
    definitionVersion: 'demo-definition-1',
    version: 'demo-task-1',
    workflow: {
      definition: {
        id: 'manual-verification',
        title: 'Implementation with manual verification',
        description: 'Use when changes require manual verification after implementation.',
        revision: 'demo-definition-1',
        steps: [
          {
            step: buildStep,
            transitions: [
              {
                id: 'implemented',
                label: 'Ready for verification',
                feedbackRequired: false,
                target: { kind: 'step', step },
              },
            ],
          },
          { step, transitions },
        ],
      },
      position: terminal
        ? { state: 'terminal', completed: key, status: 'completed', outcome: 'success' }
        : active
          ? { state: 'active', key, step, semanticStatus: 'awaiting-human' }
          : { state: 'not_started', next: step },
      transitions,
      blockers: [],
      previousFeedback: null,
    },
    requirements: requirements.items,
    pendingCount: requirements.pendingCount,
    recovery: null,
  };
}
export function demoTaskResources(specId: string, taskId: string): ResourceFacts[] {
  return Array.from({ length: 14 }, (_, i) => ({
    id: `document-${i + 1}`,
    title: `Verification material ${i + 1}`,
    kind: 'document',
    relation: i === 0 ? 'input' : 'context',
    producedFor: [],
    neededFor: i === 0 ? [{ stepId: 'manual-tests', attempt: 1 }] : [],
    origin: { kind: 'explicit_association', sourceId: taskId },
    link: {
      state: 'available',
      target: { kind: 'document', specId, documentId: 'spec', revision: 'demo-document-1' },
    },
  }));
}
export function demoTaskHistory(specId: string, taskId: string): HistoryFacts[] {
  return [
    {
      id: 'build-1',
      key: { specId, taskId, stepId: 'build', attempt: 1 },
      step: {
        id: 'build',
        executor: 'agent',
        purpose: null,
        expectedWork: { summary: 'Implement session behaviour' },
        hints: [],
      },
      startedAt: null,
      completedAt: null,
      result: 'pass',
      transitionedTo: null,
      feedback: null,
      resources: [],
      provenance: [{ source: 'workflow_history', sourceId: 'build-1' }],
    },
  ];
}
