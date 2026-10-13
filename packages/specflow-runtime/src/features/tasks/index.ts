export { createTasksFeature, type TasksFeatureDependencies } from './feature';
export type {
  TaskIdentity,
  TaskDefinitionFacts,
  ExecutionFacts,
  HistoryFacts,
  ResourceFacts,
  DefinitionSource,
  ExecutionSource,
  ResourceSource,
  HistorySource,
  ReferenceVisibility,
} from './reads/facts';
export { createDemoTaskSources, buildDemoTasks } from './demo/sources';
export { buildDemoTaskContribution } from './demo/contribution';
