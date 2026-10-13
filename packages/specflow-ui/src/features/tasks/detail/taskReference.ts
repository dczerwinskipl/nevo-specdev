import type { TaskLink } from '@nevo/specflow-contracts/specs/workspace';

/** Reference access does not imply that its owner provides an inspection reader. */
export function canInspectTaskReference(link: TaskLink) {
  return link.state === 'available' && link.target.kind === 'document';
}
