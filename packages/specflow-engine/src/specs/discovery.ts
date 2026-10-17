import type { SpecFlowEngine } from '../application';
import {
  inspectRegisteredWorkspace,
  type RegisteredWorkspaceInspection,
  type WorkspaceRegistry,
} from '../project/workspace-registry';
import { isValidSpecificationId, SpecificationError } from './model';
import { listWorkspaceSpecifications, type WorkspaceSpecification } from './repository';

/**
 * The workstation-local registry selects WHERE a spec is authoritative.
 * The selected checkout's specification.yaml selects WHAT it contains.
 * No generated index, unregistered worktree or stale primary copy is a fallback.
 */
export type DiscoveredSpecification =
  | {
      readonly status: 'available';
      readonly specId: string;
      readonly workspaceId: string;
      readonly workspaceRoot: string;
      readonly binding: 'explicit' | 'primary-default';
      readonly specification: WorkspaceSpecification;
    }
  | {
      readonly status: 'workspace_unavailable';
      readonly specId: string;
      readonly workspaceId: string;
      readonly binding: 'explicit';
      readonly reason: string;
    }
  | {
      readonly status: 'manifest_missing';
      readonly specId: string;
      readonly workspaceId: string;
      readonly workspaceRoot: string;
      readonly binding: 'explicit';
    };

/**
 * Read-only discovery of one canonical row per specId. Only registered and
 * verified roots may be queried, and linked roots are queried only if an
 * explicit binding makes them authoritative for at least one spec.
 */
export async function discoverSpecifications(
  engine: SpecFlowEngine,
  isIncluded?: (specId: string) => boolean,
): Promise<readonly DiscoveredSpecification[]> {
  const registry = await engine.readRegistry();
  const primary = await inspectRegisteredWorkspace(
    engine.context,
    registry,
    registry.primaryWorkspaceId,
  );
  if (primary.status !== 'available') {
    throw new SpecificationError(
      'SPEC_SOURCE_INVALID',
      'The authoritative primary Project Home checkout is unavailable.',
    );
  }

  const primarySpecifications = await listWorkspaceSpecifications(primary.root);
  const explicitlyBound = new Map(
    registry.specBindings.map((binding) => [binding.specId, binding]),
  );
  const found = new Map<string, DiscoveredSpecification>();

  // Primary is the documented default for unbound specifications, but an
  // explicit binding to linked ALWAYS wins, even if that source is missing.
  for (const specification of primarySpecifications) {
    const binding = explicitlyBound.get(specification.specId);
    if (binding && binding.workspaceId !== registry.primaryWorkspaceId) continue;
    found.set(specification.specId, {
      status: 'available',
      specId: specification.specId,
      workspaceId: registry.primaryWorkspaceId,
      workspaceRoot: primary.root,
      binding: binding ? 'explicit' : 'primary-default',
      specification,
    });
  }

  const inspected = new Map<string, RegisteredWorkspaceInspection>([
    [registry.primaryWorkspaceId, primary],
  ]);
  const manifests = new Map<string, readonly WorkspaceSpecification[]>([
    [registry.primaryWorkspaceId, primarySpecifications],
  ]);

  for (const binding of registry.specBindings) {
    if (!isValidSpecificationId(binding.specId)) {
      throw new SpecificationError(
        'SPEC_CONFLICT',
        'Registry binding refers to an invalid canonical specification identity.',
      );
    }

    // An excluded explicit binding cannot make an authorized, unrelated spec unavailable.
    // The primary checkout is still scanned globally: unbound IDs have no separate index.
    if (isIncluded && !isIncluded(binding.specId)) continue;

    let inspection = inspected.get(binding.workspaceId);
    if (!inspection) {
      inspection = await inspectRegisteredWorkspace(engine.context, registry, binding.workspaceId);
      inspected.set(binding.workspaceId, inspection);
    }
    if (inspection.status === 'unavailable') {
      found.set(binding.specId, {
        status: 'workspace_unavailable',
        specId: binding.specId,
        workspaceId: binding.workspaceId,
        binding: 'explicit',
        reason: inspection.reason,
      });
      continue;
    }

    let specifications = manifests.get(binding.workspaceId);
    if (!specifications) {
      specifications = await listWorkspaceSpecifications(inspection.root);
      manifests.set(binding.workspaceId, specifications);
    }
    const specification = specifications.find((item) => item.specId === binding.specId);
    found.set(
      binding.specId,
      specification
        ? {
            status: 'available',
            specId: binding.specId,
            workspaceId: binding.workspaceId,
            workspaceRoot: inspection.root,
            binding: 'explicit',
            specification,
          }
        : {
            status: 'manifest_missing',
            specId: binding.specId,
            workspaceId: binding.workspaceId,
            workspaceRoot: inspection.root,
            binding: 'explicit',
          },
    );
  }

  assertCanonicalSlugs(found);
  await ensureBindingRevisionUnchanged(engine, registry);
  return [...found.values()]
    .filter((item) => !isIncluded || isIncluded(item.specId))
    .sort((left, right) => left.specId.localeCompare(right.specId));
}

/**
 * A missing unbound ID is genuinely absent; missing bound sources are distinct
 * read-model states, not SPEC_NOT_FOUND and never a stale-primary fallback.
 */
export async function resolveSpecification(
  engine: SpecFlowEngine,
  specId: string,
): Promise<DiscoveredSpecification> {
  if (!isValidSpecificationId(specId)) {
    throw new SpecificationError('SPEC_VALIDATION_ERROR', 'Invalid specification identity.');
  }
  // Resolve only this identity. Other linked bindings cannot block a scoped read.
  // Primary manifest corruption remains a project-level integrity error.
  const items = await discoverSpecifications(engine, (candidate) => candidate === specId);
  const selected = items.find((item) => item.specId === specId);
  if (!selected) {
    throw new SpecificationError('SPEC_NOT_FOUND', 'Specification does not exist in this project.');
  }
  return selected;
}

function assertCanonicalSlugs(found: ReadonlyMap<string, DiscoveredSpecification>): void {
  const owners = new Map<string, string>();
  for (const item of found.values()) {
    if (item.status !== 'available') continue;
    const slug = item.specification.slug.toLowerCase();
    const existingId = owners.get(slug);
    if (existingId !== undefined && existingId !== item.specId) {
      throw new SpecificationError(
        'SPEC_CONFLICT',
        'Different canonical specifications have the same slug in registered workspaces.',
      );
    }
    owners.set(slug, item.specId);
  }
}

async function ensureBindingRevisionUnchanged(
  engine: SpecFlowEngine,
  initial: WorkspaceRegistry,
): Promise<void> {
  // If a writer changed binding precedence during the filesystem scan, don't
  // return a row based on an obsolete authority selection.
  const latest = await engine.readRegistry();
  if (latest.revision !== initial.revision) {
    throw new SpecificationError(
      'SPEC_CONFLICT',
      'Workspace registry changed during discovery. Re-read before using the result.',
    );
  }
}
