import type { SpecificationWorkspaceResponse } from '@nevo/specflow-contracts/specs/workspace';
import { SpecCapabilities } from '@nevo/specflow-contracts/specs';
import { SessionCapabilities } from '@nevo/specflow-contracts/sessions';
import type { RequestAuthorization } from '../../auth';
import type { SessionReferenceOwner } from '../../sessions';
import type { SpecificationWorkspaceRepository, WorkspaceContributions } from './repository';
import { readWorkspace } from './read-workspace';
import { presentWorkspace } from './presenter';
import { authorizeSessionReferences } from './authorize-projection';

export async function readAuthorizedWorkspace(
  source: SpecificationWorkspaceRepository | undefined,
  contributions: WorkspaceContributions | undefined,
  specId: string,
  authz: RequestAuthorization,
  sessions?: SessionReferenceOwner,
): Promise<
  { kind: 'ok'; value: SpecificationWorkspaceResponse } | { kind: 'unavailable' | 'not_found' }
> {
  authz.require({
    resource: SpecCapabilities,
    capability: SpecCapabilities.capabilities.View,
    scope: { specId },
  });
  if (!source) return { kind: 'unavailable' };
  const data = await readWorkspace(source, contributions, specId);
  if (!data) return { kind: 'not_found' };
  if (data.specification.id !== specId) return { kind: 'unavailable' };
  const ids = new Set<string>(),
    sections = data.sections;
  for (const item of [
    ...data.specification.attention,
    ...(sections.tasks.state === 'available' ? sections.tasks.data.attention : []),
    ...(sections.sessions.state === 'available' ? sections.sessions.data.attention : []),
    ...(sections.repository.state === 'available' ? sections.repository.data.attention : []),
  ])
    if (item.kind === 'session' && item.targetId) ids.add(item.targetId);
  if (sections.sessions.state === 'available')
    for (const session of sections.sessions.data.items) ids.add(session.id);
  if (sections.activity.state === 'available')
    for (const item of sections.activity.data.items) {
      if (item.kind === 'session' && item.targetId) ids.add(item.targetId);
      if (item.relatedSessionId) ids.add(item.relatedSessionId);
    }
  const permitted = new Set<string>();
  for (const id of ids) {
    const owner = await sessions?.resolve(id);
    if (
      owner?.specId === specId &&
      authz.can({
        resource: SessionCapabilities,
        capability: SessionCapabilities.capabilities.View,
        scope: { specId: owner.specId, sessionId: owner.sessionId },
      })
    )
      permitted.add(id);
  }
  return {
    kind: 'ok',
    value: authorizeSessionReferences(presentWorkspace(data), (id) => permitted.has(id)),
  };
}
