import type { TaskHistoryPage } from '@nevo/specflow-contracts/specs/workspace';
import { createTaskDetailFixture } from './taskDetail.test-support';

export function createHistoryDetailsFixture(): TaskHistoryPage['items'][number] {
  const fixture = createTaskDetailFixture('rich-human');
  return {
    id: 'history-record',
    key: { ...fixture.key, stepId: 'build', attempt: 1 },
    step: { ...fixture.step, id: 'build', executor: 'agent' },
    startedAt: '2026-10-10T10:00:00Z',
    completedAt: '2026-10-10T11:00:00Z',
    result: 'pass',
    transitionedTo: { kind: 'step', step: fixture.step },
    feedback: 'Historical feedback',
    resources: [
      { ...fixture.resources[0]!, id: 'legal-material-id', title: 'Available historical document' },
      {
        ...fixture.resources[1]!,
        id: 'missing-material-id',
        title: 'Unavailable historical material',
        link: { state: 'unavailable', reason: 'not_found' },
      },
      {
        ...fixture.resources[2]!,
        id: 'secret-material-id',
        title: 'Secret material title',
        origin: { kind: 'completion', sourceId: 'secret-source' },
        link: { state: 'forbidden' },
      },
    ],
    provenance: [{ source: 'workflow_history', sourceId: 'history-record' }],
  };
}
