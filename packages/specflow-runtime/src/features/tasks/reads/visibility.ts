import { SessionCapabilities } from '@nevo/specflow-contracts/sessions';
import type { RequestAuthorization } from '../../auth';
import type { ReferenceFacts, TaskIdentity } from './facts';
import type { SessionReferenceOwner } from '../../sessions';

export function taskVisibility(
  identity: TaskIdentity,
  authz: RequestAuthorization,
  sessions?: SessionReferenceOwner,
) {
  return async (link: ReferenceFacts): Promise<boolean> => {
    if (link.state === 'forbidden') return false;
    if (link.state !== 'available') return true;
    if (link.target.kind !== 'session') return link.target.specId === identity.specId;
    const owner = await sessions?.resolve(link.target.sessionId);
    return (
      !!owner &&
      owner.projectId === identity.projectId &&
      owner.workspaceId === identity.workspaceId &&
      authz.can({
        resource: SessionCapabilities,
        capability: SessionCapabilities.capabilities.View,
        scope: { specId: owner.specId, sessionId: owner.sessionId },
      })
    );
  };
}
