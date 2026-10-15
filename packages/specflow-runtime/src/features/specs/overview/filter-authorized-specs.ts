import { SpecCapabilities } from '@nevo/specflow-contracts/specs';

import type { RequestAuthorization } from '../../auth';

interface AuthorizableSpec {
  readonly id: string;
}

export function filterAuthorizedSpecs<T extends AuthorizableSpec>(
  authorization: RequestAuthorization,
  items: readonly T[],
): T[] {
  return authorization.filterByCapability(items, {
    resource: SpecCapabilities,
    capability: SpecCapabilities.capabilities.View,
    scope: (item) => ({ specId: item.id }),
  });
}

/** Per-row admission to source projection; the repository stays authorization-agnostic. */
export function canViewSpec(authorization: RequestAuthorization, specId: string): boolean {
  return authorization.can({
    resource: SpecCapabilities,
    capability: SpecCapabilities.capabilities.View,
    scope: { specId },
  });
}
