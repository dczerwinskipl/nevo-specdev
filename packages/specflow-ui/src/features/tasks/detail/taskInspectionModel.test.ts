import { describe, expect, it } from 'vitest';
import { matchesWork } from './taskInspectionModel';
import { createTaskDetailFixture } from './taskDetail.test-support';

describe('human work context identity', () => {
  it.each(['human-gates', 'rich-human', 'next-human'] as const)(
    'joins a proven matching context: %s',
    (scenario) => {
      const { response } = createTaskDetailFixture(scenario);
      const snapshot = response.snapshot!;
      const source = snapshot.sections.humanRequirements;
      if (source.state !== 'available') throw Error('fixture');
      expect(matchesWork(snapshot, response.task.id, source.data.items[0]!)).toBe(true);
    },
  );
  it.each(['spec', 'task', 'step', 'attempt', 'revision', 'relation', 'gate', 'passed'] as const)(
    'rejects a mismatch in %s',
    (field) => {
      const { response } = createTaskDetailFixture();
      const snapshot = response.snapshot!;
      const source = snapshot.sections.humanRequirements;
      if (source.state !== 'available') throw Error('fixture');
      const requirement = structuredClone(source.data.items[0]!);
      if (field === 'spec') requirement.key!.specId = 'other';
      if (field === 'task') requirement.key!.taskId = 'other';
      if (field === 'step') requirement.key!.stepId = 'other';
      if (field === 'attempt') requirement.key!.attempt++;
      if (field === 'revision') requirement.definitionRevision = 'old';
      if (field === 'relation')
        requirement.source = { kind: 'human-step', stepId: 'verify', relation: 'next-ready' };
      if (field === 'gate')
        requirement.source = {
          kind: 'human-gate',
          gateId: 'gate',
          phase: 'entry',
          role: 'owner',
          scope: 'task',
          targetId: response.task.id,
        };
      if (field === 'passed') requirement.state = 'passed';
      expect(matchesWork(snapshot, response.task.id, requirement)).toBe(false);
    },
  );
  it('does not infer an active attempt for next-ready', () => {
    const { response, key } = createTaskDetailFixture('next-human');
    const snapshot = response.snapshot!;
    const source = snapshot.sections.humanRequirements;
    if (source.state !== 'available') throw Error('fixture');
    const requirement = structuredClone(source.data.items[0]!);
    requirement.key = key;
    expect(matchesWork(snapshot, response.task.id, requirement)).toBe(false);
  });
});
