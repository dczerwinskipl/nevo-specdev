import type { UiContribution, UiExtensionPoint, UiModule } from './contracts';

/** Read-only lookup; extension-point semantics remain the host's responsibility. */
export interface UiRegistry {
  get<T extends UiContribution>(point: UiExtensionPoint<T>): readonly T[];
}

/**
 * Compose statically registered UI features at application startup.
 * Supported extension-point definitions are supplied by the composition root.
 */
export function createUiRegistry(
  supportedPoints: readonly UiExtensionPoint<UiContribution>[],
  modules: readonly UiModule[],
): UiRegistry {
  const knownPoints = new Map<string, UiExtensionPoint<UiContribution>>();
  const contributions = new Map<string, UiContribution[]>();
  const moduleIds = new Set<string>();
  const contributionIds = new Set<string>();

  for (const point of supportedPoints) {
    if (!point.id || knownPoints.has(point.id)) {
      throw new Error(`Duplicate or empty UI extension point id: ${point.id}`);
    }
    knownPoints.set(point.id, point);
    contributions.set(point.id, []);
  }

  const assertSupported = (point: UiExtensionPoint<UiContribution>) => {
    if (knownPoints.get(point.id) !== point) {
      throw new Error(`Unknown or conflicting UI extension point: ${point.id}`);
    }
  };

  for (const module of modules) {
    if (!module.id || moduleIds.has(module.id)) {
      throw new Error(`Duplicate or empty UI module id: ${module.id}`);
    }
    moduleIds.add(module.id);

    for (const { point, contribution } of module.contributions) {
      assertSupported(point);
      if (!contribution.id || contributionIds.has(contribution.id)) {
        throw new Error(`Duplicate or empty UI contribution id: ${contribution.id}`);
      }
      contributionIds.add(contribution.id);
      contributions.get(point.id)?.push(contribution);
    }
  }

  // Do not expose the mutable arrays owned by the registry builder.
  const registered = new Map<string, readonly UiContribution[]>();
  for (const [id, values] of contributions) {
    registered.set(id, Object.freeze([...values]));
  }

  return {
    get<T extends UiContribution>(point: UiExtensionPoint<T>): readonly T[] {
      assertSupported(point);
      // Controlled erasure: only contributeTo(point, NoInfer<T>) creates registrations.
      // Each entry is checked against its exact token at composition time.
      return registered.get(point.id) as readonly T[];
    },
  };
}
