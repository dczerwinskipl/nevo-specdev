import type { TaskHistoryPage, TaskResourcePage } from '@nevo/specflow-contracts/tasks';
import { SpecCapabilities } from '@nevo/specflow-contracts/specs';
import type { RequestAuthorization } from '../../auth';
import type { TaskReadDependencies } from '../detail/read-task-detail';
import { sameTask } from './facts';
import { taskVisibility } from './visibility';
import type { ReadOutcome } from './outcome';

export async function readTaskPage(
  deps: TaskReadDependencies,
  kind: 'history' | 'resources',
  specId: string,
  taskId: string,
  query: { token: string; cursor?: string; limit?: string },
  authz: RequestAuthorization,
): Promise<ReadOutcome<TaskHistoryPage | TaskResourcePage>> {
  authz.require({
    resource: SpecCapabilities,
    capability: SpecCapabilities.capabilities.View,
    scope: { specId },
  });
  if (!deps.definitions || !deps[kind]) return { kind: 'unavailable' };
  const definition = await deps.definitions.resolve(specId, taskId);
  if (!definition) return { kind: 'not_found' };
  const identity = definition.identity;
  if (identity.specId !== specId || identity.taskId !== taskId) return { kind: 'unavailable' };
  const resolved = deps.leases.resolve(
    query.token,
    kind,
    identity,
    authz.readContext(),
    query.cursor,
    query.limit === undefined ? undefined : Number(query.limit),
  );
  if (!resolved) return { kind: 'expired' };
  const visible = taskVisibility(identity, authz, deps.sessions);
  const { lease, continuation, limit } = resolved;
  const page =
    kind === 'resources'
      ? await deps.resources!.read(identity, lease.source.handle, continuation, limit, visible)
      : await deps.history!.read(identity, lease.source.handle, continuation, limit);
  if (
    !page ||
    !sameTask(page.identity, identity) ||
    page.version !== lease.source.version ||
    page.items.length > limit
  )
    return { kind: 'expired' };
  const items = [];
  // One bounded source page per request. An underfilled visible page retains its continuation.
  if (kind === 'history') {
    for (const entry of page.items as TaskHistoryPage['items']) {
      if (entry.key.specId !== specId || entry.key.taskId !== taskId)
        return { kind: 'unavailable' };
      const resources = [];
      for (const item of entry.resources) if (await visible(item.link)) resources.push(item);
      items.push({ ...entry, resources });
    }
  } else {
    for (const item of page.items as TaskResourcePage['items'])
      if (await visible(item.link)) items.push(item);
  }
  if (
    !deps.leases.resolve(
      query.token,
      kind,
      identity,
      authz.readContext(),
      query.cursor,
      query.limit === undefined ? undefined : Number(query.limit),
    )
  )
    return { kind: 'expired' };
  return {
    kind: 'ok',
    value: {
      token: query.token,
      items,
      nextCursor: deps.leases.continue(query.token, page.next, limit),
      coverage: lease.source.coverage === 'partial' ? 'partial' : page.coverage,
    } as TaskHistoryPage | TaskResourcePage,
  };
}
