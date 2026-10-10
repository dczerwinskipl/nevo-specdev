import { describe, expect, it } from 'vitest';
import { createDemoSpecsRepositories } from '../../src/features/specs/demo/repositories';

describe('Demo Workspace lifecycle', () => {
  it('never marks active tasks as completed and matches Overview progress', async () => {
    const repositories = createDemoSpecsRepositories();
    const overview = await repositories.overviewRepository.readCurrent();
    for (const item of overview.items) {
      const workspace = await repositories.workspaceRepository.readWorkspace(item.id);
      expect(workspace).not.toBeNull();
      if (!workspace) continue;
      const tasks = workspace.sections.tasks;
      expect(tasks.state).toBe('available');
      if (tasks.state !== 'available') continue;
      const all = tasks.data.groups.flatMap((group) => group.tasks);
      expect(all.filter((task) => task.status.lifecycle === 'completed')).toHaveLength(
        item.progress.completed,
      );
      expect(all).toHaveLength(item.progress.total);
      for (const execution of item.currentExecutions) {
        for (const id of execution.taskIds) {
          expect(all.find((task) => task.id === id)?.status.lifecycle).toBe('in_progress');
        }
      }
    }
  });
});
