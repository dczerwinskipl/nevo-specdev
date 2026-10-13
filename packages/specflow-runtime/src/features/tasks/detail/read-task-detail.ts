import type { SpecificationTaskResponse, TaskSnapshot } from '@nevo/specflow-contracts/tasks';
import { SpecCapabilities } from '@nevo/specflow-contracts/specs';
import type { RequestAuthorization } from '../../auth';
import type { SessionReferenceOwner } from '../../sessions';
import type {
  DefinitionSource,
  ExecutionSource,
  HistorySource,
  ResourceSource,
} from '../reads/facts';
import { sameTask } from '../reads/facts';
import { taskVisibility } from '../reads/visibility';
import { PageLeases } from '../reads/page-leases';
import type { ReadOutcome } from '../reads/outcome';
import { projectionRevision } from '../reads/projection-revision';

export interface TaskReadDependencies {
  definitions?: DefinitionSource;
  execution?: ExecutionSource;
  history?: HistorySource;
  resources?: ResourceSource;
  sessions?: SessionReferenceOwner;
  leases: PageLeases;
}
export async function readTaskDetail(
  deps: TaskReadDependencies,
  specId: string,
  taskId: string,
  authz: RequestAuthorization,
): Promise<ReadOutcome<SpecificationTaskResponse>> {
  authz.require({
    resource: SpecCapabilities,
    capability: SpecCapabilities.capabilities.View,
    scope: { specId },
  });
  if (!deps.definitions) return { kind: 'unavailable' };
  const definition = await deps.definitions.resolve(specId, taskId);
  if (!definition) return { kind: 'not_found' };
  const identity = definition.identity;
  if (identity.specId !== specId || identity.taskId !== taskId || definition.task.id !== taskId)
    return { kind: 'unavailable' };
  const visible = taskVisibility(identity, authz, deps.sessions);
  const execution = await deps.execution?.inspect(identity, definition.version);
  const coherent =
    execution &&
    sameTask(execution.identity, identity) &&
    execution.definitionVersion === definition.version;
  const missing = { state: 'unavailable' as const, reason: 'not_implemented' as const };
  const snapshot: TaskSnapshot = {
    revision: JSON.stringify([definition.version, coherent ? execution.version : null]),
    specification: { id: specId, title: definition.specificationTitle },
    summary: definition.summary,
    group: definition.group,
    taskType: definition.taskType,
    sections: {
      work: coherent ? { state: 'available', data: structuredClone(execution.workflow) } : missing,
      humanRequirements: missing,
      resources: missing,
      document: definition.document,
      dependencies: { state: 'available', data: { items: [] } },
      recovery: missing,
      history: missing,
    },
  };
  for (const dependency of definition.dependencies)
    if ((await visible(dependency.link)) && snapshot.sections.dependencies.state === 'available')
      snapshot.sections.dependencies.data.items.push(dependency);
  if (coherent) {
    const requirements = structuredClone(execution.requirements);
    for (const requirement of requirements) {
      const evidence = [];
      for (const item of requirement.evidence) if (await visible(item.link)) evidence.push(item);
      if (evidence.length !== requirement.evidence.length) {
        requirement.actions = [];
        requirement.inspectionProblem = 'Required material cannot be accessed.';
      }
      requirement.evidence = evidence;
    }
    snapshot.sections.humanRequirements = {
      state: 'available',
      data: { items: requirements, pendingCount: execution.pendingCount },
    };
    snapshot.sections.recovery =
      !execution.recovery || (await visible(execution.recovery.link))
        ? { state: 'available', data: execution.recovery }
        : { state: 'forbidden' };
  }
  const context = authz.readContext();
  const resources = await deps.resources?.open(identity, visible);
  if (
    resources?.coverage === 'complete' &&
    sameTask(resources.identity, identity) &&
    Number.isSafeInteger(resources.visibleTotal) &&
    resources.visibleTotal >= 0
  ) {
    const page = await deps.resources!.read(identity, resources.handle, null, 3, visible);
    if (
      page?.coverage === 'complete' &&
      sameTask(page.identity, identity) &&
      page.version === resources.version &&
      page.items.length <= 3 &&
      page.items.length === Math.min(3, resources.visibleTotal) &&
      (page.next !== null) === resources.visibleTotal > page.items.length
    ) {
      let safe = true;
      for (const item of page.items) if (!(await visible(item.link))) safe = false;
      if (safe)
        snapshot.sections.resources = {
          state: 'available',
          data: {
            recommended: page.items,
            visibleTotal: resources.visibleTotal,
            page:
              page.next === null
                ? null
                : deps.leases.create({
                    identity,
                    context,
                    kind: 'resources',
                    source: resources,
                    start: page.next,
                    initialLimit: 20,
                  }),
          },
        };
    }
  }
  const history = coherent ? await deps.history?.open(identity) : undefined;
  if (history && sameTask(history.identity, identity))
    snapshot.sections.history = {
      state: 'available',
      data: deps.leases.create({
        identity,
        context,
        kind: 'history',
        source: history,
        start: null,
        initialLimit: 5,
      }),
    };
  snapshot.revision = projectionRevision(identity, context, [
    definition.version,
    coherent ? execution.version : null,
    resources?.version ?? null,
    history?.version ?? null,
  ]);
  return {
    kind: 'ok',
    value: {
      task: definition.task,
      purpose: definition.purpose,
      acceptanceCriteria: definition.acceptanceCriteria,
      workflow: definition.workflow,
      snapshot,
    },
  };
}
