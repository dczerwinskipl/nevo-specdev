import type { DemoCatalogue, DemoSpecification } from '../../demo-catalogue';
import type { TasksFeatureDependencies } from '../feature';
import type {
  TaskDefinitionFacts,
  SourcePage,
  TaskIdentity,
  SourceRead,
  ReferenceVisibility,
  ResourceFacts,
} from '../reads/facts';
import { demoExecutionFacts, demoTaskHistory, demoTaskResources } from './execution';

export function buildDemoTasks(record: DemoSpecification): TaskDefinitionFacts['task'][] {
  const active = new Set(record.currentExecutions?.flatMap((item) => [...item.taskIds]) ?? []);
  const ids = Array.from(
    { length: record.progress.total },
    (_, i) => 'TASK-' + String(i + 1).padStart(2, '0'),
  );
  const completed = new Set(
    ids.filter((id) => !active.has(id)).slice(0, record.progress.completed),
  );
  return ids.map((id) => ({
    id,
    title: id + ' · ' + record.title,
    status: {
      id: completed.has(id) ? 'completed' : active.has(id) ? 'in_progress' : 'ready',
      label: completed.has(id) ? 'Completed' : active.has(id) ? 'In progress' : 'Ready',
      lifecycle: completed.has(id) ? 'completed' : active.has(id) ? 'in_progress' : 'pending',
    },
  }));
}
const identityFor = (specId: string, taskId: string): TaskIdentity => ({
  projectId: 'demo-project',
  workspaceId: 'demo-workspace',
  specId,
  taskId,
});
export function createDemoTaskSources(catalogue: DemoCatalogue): TasksFeatureDependencies {
  const definitions: NonNullable<TasksFeatureDependencies['definitions']> = {
    async resolve(specId, taskId) {
      const record = await catalogue.find(specId),
        task = record && buildDemoTasks(record).find((task) => task.id === taskId);
      if (!record || !task) return null;
      return {
        identity: identityFor(specId, taskId),
        version: 'demo-definition-1',
        specificationTitle: record.title,
        task,
        purpose: 'Demonstration Task for ' + record.title,
        acceptanceCriteria: [],
        summary: 'Demonstration Task for ' + record.title,
        group: { id: 'tasks', label: 'Tasks' },
        taskType: null,
        document: { state: 'available', data: { id: taskId, revision: 'demo-document-1' } },
        dependencies: [],
      };
    },
  };
  const open = async (identity: TaskIdentity): Promise<SourceRead | null> =>
    (await definitions.resolve(identity.specId, identity.taskId))
      ? { identity, handle: 'demo-history-1', version: 'demo-history-1', coverage: 'complete' }
      : null;
  const visibleResources = async (identity: TaskIdentity, visible: ReferenceVisibility) => {
    const items: ResourceFacts[] = [];
    for (const resource of demoTaskResources(identity.specId, identity.taskId))
      if (await visible(resource.link)) items.push(resource);
    return items;
  };
  const page = <T>(
    items: T[],
    identity: TaskIdentity,
    version: string,
    continuation: string | null,
    limit: number,
  ): SourcePage<T> | null => {
    const start = continuation === null ? 0 : Number(continuation);
    if (
      !Number.isSafeInteger(start) ||
      start < 0 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 50
    )
      return null;
    const end = Math.min(start + limit, items.length);
    return {
      identity,
      version,
      items: items.slice(start, end),
      next: end < items.length ? String(end) : null,
      coverage: 'complete',
    };
  };
  return {
    definitions,
    execution: {
      async inspect(identity, version) {
        const definition = await definitions.resolve(identity.specId, identity.taskId);
        return definition?.version === version
          ? demoExecutionFacts(identity.specId, definition.task)
          : null;
      },
    },
    history: {
      open,
      async read(identity, handle, continuation, limit) {
        if (handle !== 'demo-history-1' || !(await open(identity))) return null;
        return page(
          demoTaskHistory(identity.specId, identity.taskId),
          identity,
          handle,
          continuation,
          limit,
        );
      },
    },
    resources: {
      async open(identity, visible) {
        if (!(await open(identity))) return null;
        return {
          identity,
          handle: 'demo-resources-1',
          version: 'demo-resources-1',
          coverage: 'complete',
          visibleTotal: (await visibleResources(identity, visible)).length,
        };
      },
      async read(identity, handle, continuation, limit, visible) {
        if (handle !== 'demo-resources-1' || !(await open(identity))) return null;
        return page(
          await visibleResources(identity, visible),
          identity,
          handle,
          continuation,
          limit,
        );
      },
    },
  };
}
