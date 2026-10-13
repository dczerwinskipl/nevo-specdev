import { Value } from 'typebox/value';
import { describe, expect, it } from 'vitest';
import { TaskSnapshotSchema, type TaskSnapshot } from './task-read';

function snapshot(): TaskSnapshot {
  const build = {
    id: 'build',
    executor: 'agent' as const,
    purpose: null,
    expectedWork: null,
    hints: [],
  };
  const verify = { ...build, id: 'verify', executor: 'human' as const };
  const transitions = [
    {
      id: 'pass',
      feedbackRequired: false,
      target: { kind: 'terminal' as const, status: 'done', outcome: 'success' as const },
    },
    { id: 'return', feedbackRequired: true, target: { kind: 'step' as const, step: build } },
  ];
  const unavailable = { state: 'unavailable' as const, reason: 'not_implemented' as const };
  return {
    revision: '1',
    specification: { id: 'spec', title: 'Specification' },
    taskType: null,
    group: null,
    summary: null,
    sections: {
      work: {
        state: 'available',
        data: {
          definition: {
            id: 'flow',
            title: 'Flow',
            description: null,
            revision: '1',
            steps: [
              {
                step: build,
                transitions: [
                  { id: 'ready', feedbackRequired: false, target: { kind: 'step', step: verify } },
                ],
              },
              { step: verify, transitions },
            ],
          },
          position: {
            state: 'active',
            key: { specId: 'spec', taskId: 'task', stepId: 'verify', attempt: 2 },
            step: verify,
            semanticStatus: 'verify',
          },
          transitions,
          blockers: [],
          previousFeedback: null,
        },
      },
      humanRequirements: unavailable,
      resources: unavailable,
      document: unavailable,
      dependencies: unavailable,
      recovery: unavailable,
      history: unavailable,
    },
  };
}
describe('Task flow definition contract', () => {
  it('represents all steps, branches, return transitions and an independent active attempt', () => {
    expect(Value.Check(TaskSnapshotSchema, snapshot())).toBe(true);
  });
  it('rejects an available work projection without the full definition graph', () => {
    const value = snapshot();
    if (value.sections.work.state !== 'available') throw new Error('Expected work');
    const definition: Record<string, unknown> = value.sections.work.data.definition;
    delete definition.steps;
    expect(Value.Check(TaskSnapshotSchema, value)).toBe(false);
  });
  it('requires an explicit target for every definition transition', () => {
    const value = snapshot();
    if (value.sections.work.state !== 'available') throw new Error('Expected work');
    const transition: Record<string, unknown> =
      value.sections.work.data.definition.steps[0]!.transitions[0]!;
    delete transition.target;
    expect(Value.Check(TaskSnapshotSchema, value)).toBe(false);
  });
});
