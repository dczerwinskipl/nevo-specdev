import type {
  SpecificationTaskResponse,
  TaskResource,
  TaskHumanRequirement,
} from '@nevo/specflow-contracts/specs/workspace';
import { markdownIntro } from '../../documents/description/markdownIntro';

export type TaskScenario =
  | 'rich-human'
  | 'next-human'
  | 'no-next'
  | 'work-unavailable'
  | 'human-forbidden'
  | 'mismatch'
  | 'human-gates'
  | 'agent'
  | 'gates'
  | 'human-only'
  | 'checkpoint'
  | 'retry'
  | 'terminal'
  | 'unavailable'
  | 'forbidden'
  | 'unknown-resource'
  | 'not-started'
  | 'no-description'
  | 'recovery';
export function createTaskDetailFixture(scenario: TaskScenario = 'human-gates', stress = false) {
  const specId = 'admission';
  const taskId = 'TASK-03';
  const title = stress
    ? 'Preserve user context across a long running session. '.repeat(8)
    : 'Preserve session and navigation context';
  const document = `# ${title}\n\nPreserve **user context** when returning from [related work](https://example.com). ${stress ? 'Support a long lived session without losing access to current work. '.repeat(12) : ''}\n\n## Acceptance criteria\n\n- Return to the original task.\n- Restore scroll and keyboard focus.\n\n${stress ? Array.from({ length: 100 }, (_, index) => `## Section ${index + 1}\n\n${'Long document content with useful information. '.repeat(25)}`).join('\n\n') : ''}`;
  const key = {
    specId,
    taskId,
    stepId: 'verify',
    attempt: ['retry', 'rich-human'].includes(scenario) ? 2 : 1,
  };
  const human = [
    'human-gates',
    'human-only',
    'rich-human',
    'next-human',
    'work-unavailable',
    'human-forbidden',
    'mismatch',
  ].includes(scenario);
  const step = {
    id: 'verify',
    executor: human ? ('human' as const) : ('agent' as const),
    purpose: 'Check return navigation, session expiry and two browser tabs.',
    expectedWork: { summary: 'Verify session behaviour' },
    hints:
      scenario === 'rich-human'
        ? [
            { kind: 'doc' as const, ref: 'docs/session-return.md' },
            { kind: 'skill' as const, ref: 'nevo-agents-reviewer' },
            {
              kind: 'file' as const,
              ref: stress ? 'src/very-long-path/'.repeat(12) + 'session.ts' : 'src/session.ts',
            },
          ]
        : [],
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
      target: { kind: 'terminal' as const, status: 'done', outcome: 'success' as const },
    },
    {
      id: 'returned',
      label: 'Return for correction',
      feedbackRequired: true,
      target: { kind: 'step' as const, step: buildStep },
    },
  ];
  const resources: TaskResource[] =
    scenario === 'human-only' || scenario === 'gates'
      ? []
      : Array.from({ length: 14 }, (_, index) => ({
          id: `resource-${index}`,
          title:
            index === 0 && stress
              ? 'Authoritative supporting document with a long name. '.repeat(8)
              : `Verification material ${index + 1}`,
          kind: scenario === 'unknown-resource' && index === 0 ? 'custom-result' : 'document',
          relation: index === 0 ? 'input' : 'output',
          producedFor: [{ ...key, stepId: 'build', attempt: 1 }],
          neededFor: index < 2 ? [{ stepId: 'verify', attempt: key.attempt }] : [],
          origin: { kind: 'completion', sourceId: `build-${index}` },
          link: {
            state: 'available',
            target:
              scenario === 'unknown-resource' && index === 0
                ? { kind: 'report', specId, reportId: 'custom', revision: 'fixture-1' }
                : {
                    kind: 'document',
                    specId,
                    documentId: `document-${index}`,
                    revision: 'fixture-1',
                  },
          },
        }));
  const requirements: TaskHumanRequirement[] = human
    ? [
        {
          id: 'human-work',
          definitionRevision: 'definition-1',
          source: { kind: 'human-step', stepId: step.id, relation: 'current' },
          key,
          title: step.expectedWork.summary,
          instruction:
            scenario === 'rich-human'
              ? 'Confirm the browser back button restores the selected tab.'
              : step.purpose,
          state: 'pending',
          actions: [
            { label: 'Scenarios passed', feedbackRequired: false },
            { label: 'Return for correction', feedbackRequired: true },
          ],
          evidence: [
            {
              title: 'Verification instructions',
              link: {
                state: 'available',
                target: {
                  kind: 'document',
                  specId,
                  documentId: 'evidence-guide',
                  revision: 'fixture-1',
                },
              },
            },
          ],
        },
      ]
    : [];
  if (['human-gates', 'gates', 'rich-human', 'work-unavailable', 'mismatch'].includes(scenario))
    requirements.push(
      ...Array.from({ length: 20 }, (_, index): TaskHumanRequirement => ({
        id: `gate-${index}`,
        definitionRevision: 'definition-1',
        source: {
          kind: 'human-gate',
          gateId: `gate-${index}`,
          phase: 'exit',
          role: 'owner',
          scope: 'step',
          targetId: taskId,
        },
        key,
        title: `Independent verification ${index + 1}`,
        instruction:
          index === 0 && stress ? 'A specific reason for this requirement. '.repeat(20) : null,
        state: 'pending',
        actions: [],
        evidence: [],
      })),
    );
  const response: SpecificationTaskResponse = {
    task: {
      id: taskId,
      title,
      status: {
        id: 'verification',
        label: 'Verification',
        lifecycle: scenario === 'terminal' ? 'completed' : 'in_progress',
      },
    },
    acceptanceCriteria: [],
    snapshot: {
      revision: 'fixture-1',
      specification: { id: specId, title: 'Session context' },
      group: null,
      taskType: null,
      summary: markdownIntro(document, title).intro,
      sections: {
        work: {
          state: 'available',
          data: {
            definition: {
              id: 'custom-flow',
              title: 'Implementation with manual verification',
              description: 'Use this flow when changes need human verification.',
              revision: 'definition-1',
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
            position:
              scenario === 'not-started' || scenario === 'next-human' || scenario === 'no-next'
                ? { state: 'not_started', next: scenario === 'no-next' ? null : step }
                : scenario === 'terminal'
                  ? { state: 'terminal', completed: key, status: 'done', outcome: 'success' }
                  : scenario === 'checkpoint'
                    ? {
                        state: 'checkpoint',
                        completed: { ...key, stepId: 'build' },
                        next: step,
                        nextAttempt: null,
                      }
                    : { state: 'active', key, step, semanticStatus: 'verification' },
            blockers:
              scenario === 'rich-human'
                ? [
                    {
                      operation: 'finish',
                      code: 'evidence_pending',
                      message: 'Check the linked verification evidence.',
                    },
                  ]
                : [],
            transitions,
            previousFeedback:
              scenario === 'retry' || scenario === 'rich-human'
                ? {
                    key: { ...key, attempt: 1 },
                    result: 'fail',
                    text: 'Return navigation lost the original scroll position.',
                  }
                : null,
          },
        },
        document: {
          state: 'available',
          data: {
            id: taskId,
            revision: 'fixture-1',
            hasMore: markdownIntro(document, title).hasMore,
          },
        },
        resources: {
          state: 'available',
          data: {
            recommended: resources.slice(0, 3),
            visibleTotal: resources.length,
            page: resources.length > 3 ? { token: 'fixture-1', initialLimit: 20 } : null,
          },
        },
        humanRequirements: {
          state: 'available',
          data: { items: requirements, pendingCount: requirements.length },
        },
        dependencies: { state: 'available', data: { items: [] } },
        recovery: { state: 'available', data: null },
        history: { state: 'available', data: { token: 'fixture-1', initialLimit: 5 } },
      },
    },
  };
  if (scenario === 'next-human') {
    requirements[0]!.source = { kind: 'human-step', stepId: step.id, relation: 'next-ready' };
    requirements[0]!.key = null;
  }
  if (scenario === 'mismatch') requirements[0]!.definitionRevision = 'old-definition';
  if (scenario === 'work-unavailable')
    response.snapshot!.sections.work = { state: 'unavailable', reason: 'not_implemented' };
  if (scenario === 'human-forbidden')
    response.snapshot!.sections.humanRequirements = { state: 'forbidden' };
  if (scenario === 'no-description') {
    response.snapshot!.summary = null;
    response.snapshot!.sections.document = { state: 'available', data: null };
  }
  if (scenario === 'recovery')
    response.snapshot!.sections.recovery = {
      state: 'available',
      data: {
        id: 'recovery-1',
        state: 'manual_action_required',
        summary: 'The previous operation stopped. Inspect the working tree before continuing.',
        link: { state: 'unavailable', reason: 'not_implemented' },
      },
    };
  if (scenario === 'unavailable' || scenario === 'forbidden') {
    const empty =
      scenario === 'unavailable'
        ? { state: 'unavailable' as const, reason: 'not_implemented' as const }
        : { state: 'forbidden' as const };
    response.snapshot!.summary = null;
    response.snapshot!.sections = {
      work: empty,
      document: empty,
      humanRequirements: empty,
      resources: empty,
      history: empty,
      dependencies: empty,
      recovery: empty,
    };
  }
  return { response, resources, document, step, key };
}
