import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

import { parse } from 'yaml';

import {
  SpecificationError,
  parseSpecificationManifest,
  validateSpecificationSlug,
  type SpecificationManifest,
} from './model';

export interface WorkspaceSpecification extends SpecificationManifest {
  readonly relativeManifestPath: string;
  readonly relativeOverviewPath: string;
}

/**
 * Checkout-local canonical reader. Callers must select an Engine-verified root;
 * cross-worktree selection, local spec bindings and unavailable projections
 * belong to E2.T03, not to this repository.
 *
 * Deliberately never reads specs/index.generated.json or follows symlinks.
 */
export async function listWorkspaceSpecifications(
  workspaceRoot: string,
): Promise<readonly WorkspaceSpecification[]> {
  await assertWorkspaceRoot(workspaceRoot);
  const specsRoot = join(workspaceRoot, 'specs');
  if (!(await physicalDirectoryExists(specsRoot))) return [];

  const specifications: WorkspaceSpecification[] = [];
  const seenIds = new Set<string>();
  const seenSlugs = new Set<string>();

  for (const location of ['active', 'archive'] as const) {
    const directory = join(specsRoot, location);
    if (!(await physicalDirectoryExists(directory))) continue;

    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        throw new SpecificationError(
          'SPEC_SOURCE_INVALID',
          'Specification entry must not be a symbolic link: ' + entry.name,
        );
      }
      if (!entry.isDirectory()) continue;

      let slug: string;
      try {
        slug = validateSpecificationSlug(entry.name);
      } catch {
        throw new SpecificationError(
          'SPEC_SOURCE_INVALID',
          'Invalid specification directory name: ' + entry.name,
        );
      }

      const base = join(directory, slug);
      await requirePhysicalDirectory(base);
      // Do not hide a second manifest, case alias, symlink or legacy collision
      // by preferring the new filename. Exactly one physical source is allowed.
      const manifestEntries = (await readdir(base, { withFileTypes: true })).filter((item) =>
        /^(?:change|specification)\.yaml$/iu.test(item.name),
      );
      if (
        manifestEntries.length !== 1 ||
        (manifestEntries[0]?.name !== 'change.yaml' &&
          manifestEntries[0]?.name !== 'specification.yaml')
      ) {
        throw new SpecificationError(
          'SPEC_SOURCE_INVALID',
          'Specification directory must contain exactly one canonical manifest filename.',
        );
      }
      const manifestName = manifestEntries[0].name;
      const relativeManifestPath = 'specs/' + location + '/' + slug + '/' + manifestName;
      const relativeOverviewPath = 'specs/' + location + '/' + slug + '/overview.md';
      const manifestPath = join(base, manifestName);
      await requirePhysicalFile(manifestPath);

      let parsed: unknown;
      try {
        parsed = parse(await readFile(manifestPath, 'utf8')) as unknown;
      } catch {
        throw new SpecificationError(
          'SPEC_SOURCE_INVALID',
          'Invalid YAML in specification manifest: ' + relativeManifestPath,
        );
      }

      const manifest = parseSpecificationManifest(parsed, slug, location);
      if (seenIds.has(manifest.specId) || seenSlugs.has(slug)) {
        throw new SpecificationError(
          'SPEC_CONFLICT',
          'Duplicate specification ID or slug in one checkout: ' + slug,
        );
      }
      seenIds.add(manifest.specId);
      seenSlugs.add(slug);
      specifications.push({ ...manifest, relativeManifestPath, relativeOverviewPath });
    }
  }
  return specifications;
}

/** Explicit scope; not an active-first fallback that can hide duplicates. */
export async function readWorkspaceSpecification(
  workspaceRoot: string,
  specId: string,
): Promise<WorkspaceSpecification> {
  const specifications = await listWorkspaceSpecifications(workspaceRoot);
  const found = specifications.find((specification) => specification.specId === specId);
  if (!found) {
    throw new SpecificationError('SPEC_NOT_FOUND', 'Specification was not found in this checkout.');
  }
  return found;
}

async function assertWorkspaceRoot(root: string): Promise<void> {
  if (!isAbsolute(root)) {
    throw new SpecificationError('SPEC_SOURCE_INVALID', 'Workspace root must be absolute.');
  }
  await requirePhysicalDirectory(root);
  if ((await realpath(root)) !== root) {
    throw new SpecificationError(
      'SPEC_SOURCE_INVALID',
      'Workspace root must be the canonical physical checkout path.',
    );
  }
}

async function physicalDirectoryExists(path: string): Promise<boolean> {
  try {
    await requirePhysicalDirectory(path);
    return true;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

async function requirePhysicalDirectory(path: string): Promise<void> {
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new SpecificationError('SPEC_SOURCE_INVALID', 'Spec source directory is redirected.');
  }
}

async function requirePhysicalFile(path: string): Promise<void> {
  let stat;
  try {
    stat = await lstat(path);
  } catch (error) {
    if (isMissing(error)) {
      throw new SpecificationError(
        'SPEC_SOURCE_INVALID',
        'Specification directory has no manifest: ' + path,
      );
    }
    throw error;
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new SpecificationError(
      'SPEC_SOURCE_INVALID',
      'Spec manifest must be a regular file: ' + path,
    );
  }
}

function isMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
