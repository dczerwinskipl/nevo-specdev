import type {
  TaskLink,
  TaskResource,
  TaskSnapshot,
} from '@nevo/specflow-contracts/specs/workspace';

/** All Task reference surfaces use the same policy, before exposing titles or identifiers. */
export function canReadTaskReference(
  link: TaskLink,
  specId: string,
  canReadSession: (id: string) => boolean,
) {
  if (link.state === 'forbidden') return false;
  if (link.state !== 'available') return true;
  return link.target.kind === 'session'
    ? canReadSession(link.target.sessionId)
    : link.target.specId === specId;
}

export function authorizedTaskResources(
  items: TaskResource[],
  specId: string,
  canReadSession: (id: string) => boolean,
) {
  return items.filter((item) => canReadTaskReference(item.link, specId, canReadSession));
}

/** Mutates only the response-owned clone, never the adapter's snapshot. */
export function authorizeTaskReferences(
  snapshot: TaskSnapshot,
  specId: string,
  canReadSession: (id: string) => boolean,
) {
  const allowed = (link: TaskLink) => canReadTaskReference(link, specId, canReadSession);
  const { humanRequirements, dependencies, recovery } = snapshot.sections;
  if (humanRequirements.state === 'available') {
    for (const item of humanRequirements.data.items)
      item.evidence = item.evidence.filter((evidence) => allowed(evidence.link));
  }
  if (dependencies.state === 'available')
    dependencies.data.items = dependencies.data.items.filter((item) => allowed(item.link));
  if (recovery.state === 'available' && recovery.data && !allowed(recovery.data.link))
    snapshot.sections.recovery = { state: 'forbidden' };
}
