import type { RuntimeFeature } from '../runtime-feature';
import type { TaskReadDependencies } from './detail/read-task-detail';
import { taskReadEndpoint } from './endpoint';
import { PageLeases, type LeaseOptions } from './reads/page-leases';

export type TasksFeatureDependencies = Omit<TaskReadDependencies, 'leases'> & {
  leaseOptions?: LeaseOptions;
};
export function createTasksFeature(dependencies: TasksFeatureDependencies = {}): RuntimeFeature {
  const reads: TaskReadDependencies = {
    ...dependencies,
    leases: new PageLeases(dependencies.leaseOptions),
  };
  return {
    authorizationResources: [],
    register(app) {
      app.register(taskReadEndpoint, { dependencies: reads });
    },
  };
}
