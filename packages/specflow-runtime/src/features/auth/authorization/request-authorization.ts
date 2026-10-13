import {
  AuthorizationConfigurationError,
  type Authorization,
  type CapabilityId,
  type ResourceDefinition,
  type Scope,
} from '@nevo/authorization';
import type {
  CapabilityProjection,
  WithCapabilities as ContractWithCapabilities,
} from '@nevo/specflow-contracts/authorization';

import type { AuthorizationAccess } from './resolve-access';
import { AuthenticationRequiredError, AuthorizationForbiddenError } from './errors';
import { projectCapabilities } from './capability-projection';

export type ResourceCapability<R extends ResourceDefinition> =
  R['capabilities'][keyof R['capabilities']] & string;

export interface AuthorizationTarget<R extends ResourceDefinition = ResourceDefinition> {
  readonly resource: R;
  readonly scope?: Scope;
}

export interface AuthorizationCapabilityCheck<
  R extends ResourceDefinition = ResourceDefinition,
> extends AuthorizationTarget<R> {
  readonly capability: ResourceCapability<R>;
}

export interface AuthorizationAnyScopeCapabilityCheck<
  R extends ResourceDefinition = ResourceDefinition,
> {
  readonly resource: R;
  readonly capability: ResourceCapability<R>;
}

export type AuthorizationTargets = Readonly<
  Record<string, AuthorizationTarget<ResourceDefinition>>
>;

type TargetResources<Targets extends AuthorizationTargets> = {
  [Key in keyof Targets]: Targets[Key]['resource'];
};

export type WithCapabilities<T, Targets extends AuthorizationTargets> = ContractWithCapabilities<
  T,
  TargetResources<Targets>
>;

export interface RequestAuthorization {
  /** Trusted identity and immutable policy instance for disposable, non-authoritative reads. */
  readContext(): { readonly subject: string; readonly policy: object };
  requireAccess(): void;

  can<R extends ResourceDefinition>(input: AuthorizationCapabilityCheck<R>): boolean;

  require<R extends ResourceDefinition>(input: AuthorizationCapabilityCheck<R>): void;

  hasCapabilityInAnyScope<R extends ResourceDefinition>(
    input: AuthorizationAnyScopeCapabilityCheck<R>,
  ): boolean;

  requireCapabilityInAnyScope<R extends ResourceDefinition>(
    input: AuthorizationAnyScopeCapabilityCheck<R>,
  ): void;

  resolveCapabilities<R extends ResourceDefinition>(
    target: AuthorizationTarget<R>,
  ): CapabilityProjection<R>;

  filterByCapability<T, R extends ResourceDefinition>(
    items: readonly T[],
    input: {
      readonly resource: R;
      readonly capability: ResourceCapability<R>;
      readonly scope: (item: T) => Scope;
    },
  ): T[];

  withCapabilities<T, const Targets extends AuthorizationTargets>(
    value: T,
    targets: Targets,
  ): WithCapabilities<T, Targets>;
}

export function createRequestAuthorization(
  access: AuthorizationAccess,
  authorization: Authorization,
): RequestAuthorization {
  const cache = new Map<string, readonly CapabilityId[]>();

  const requireAccess = () => {
    if (access.mode === 'unauthenticated') {
      throw new AuthenticationRequiredError();
    }
  };

  const resolveEffective = (
    resource: ResourceDefinition,
    scope: Scope,
  ): readonly CapabilityId[] => {
    if (access.mode === 'unauthenticated') {
      throw new AuthenticationRequiredError();
    }

    const key = cacheKey(resource.name, scope);
    const cached = cache.get(key);
    if (cached) {
      return cached;
    }

    const capabilities =
      access.mode === 'disabled'
        ? authorization.resourceCapabilities(resource.name)
        : authorization.resolveCapabilities({
            subject: access.subject,
            resource: { name: resource.name, scope },
          }).capabilities;

    cache.set(key, capabilities);
    return capabilities;
  };

  const assertCapability = (resource: ResourceDefinition, capability: CapabilityId): void => {
    const registered = authorization.resourceCapabilities(resource.name);
    if (!registered.includes(capability)) {
      throw new AuthorizationConfigurationError(
        `Capability '${capability}' does not belong to resource '${resource.name}'.`,
      );
    }
  };

  const api: RequestAuthorization = {
    readContext: () => {
      requireAccess();
      return {
        subject: access.mode === 'subject' ? JSON.stringify(access.subject) : 'trusted-local',
        policy: authorization,
      };
    },
    requireAccess,

    can(input) {
      const scope = input.scope ?? {};
      assertCapability(input.resource, input.capability);
      return resolveEffective(input.resource, scope).includes(input.capability);
    },

    require(input) {
      if (!api.can(input)) {
        throw new AuthorizationForbiddenError();
      }
    },

    hasCapabilityInAnyScope(input) {
      if (access.mode === 'unauthenticated') {
        throw new AuthenticationRequiredError();
      }

      assertCapability(input.resource, input.capability);

      if (access.mode === 'disabled') {
        return true;
      }

      return authorization.hasCapabilityInAnyScope({
        subject: access.subject,
        resource: input.resource.name,
        capability: input.capability,
      });
    },

    requireCapabilityInAnyScope(input) {
      if (!api.hasCapabilityInAnyScope(input)) {
        throw new AuthorizationForbiddenError();
      }
    },

    resolveCapabilities(target) {
      const scope = target.scope ?? {};
      return projectCapabilities(target.resource, resolveEffective(target.resource, scope));
    },

    filterByCapability(items, input) {
      requireAccess();
      return items.filter((item) =>
        api.can({
          resource: input.resource,
          capability: input.capability,
          scope: input.scope(item),
        }),
      );
    },

    withCapabilities(value, targets) {
      requireAccess();
      const capabilities: Record<string, Readonly<Record<string, boolean>>> = {};
      for (const [key, target] of Object.entries(targets)) {
        capabilities[key] = api.resolveCapabilities(target);
      }

      return {
        ...value,
        capabilities,
      } as WithCapabilities<typeof value, typeof targets>;
    },
  };

  return api;
}

function cacheKey(resourceName: string, scope: Scope): string {
  return `${resourceName}:${JSON.stringify(
    Object.entries(scope).sort(([left], [right]) => left.localeCompare(right)),
  )}`;
}
