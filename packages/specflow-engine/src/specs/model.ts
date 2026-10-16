import { createHash } from 'node:crypto';

import { stringify } from 'yaml';

export type SpecificationLocation = 'active' | 'archive';

export type SpecificationErrorCode =
  'SPEC_VALIDATION_ERROR' | 'SPEC_SOURCE_INVALID' | 'SPEC_CONFLICT' | 'SPEC_NOT_FOUND';

export class SpecificationError extends Error {
  readonly code: SpecificationErrorCode;

  constructor(code: SpecificationErrorCode, message: string) {
    super(message);
    this.name = 'SpecificationError';
    this.code = code;
  }
}

/**
 * A manifest is the only authority for canonical Spec metadata and status.
 * The generated indexes and the Runtime Overview are projections, never stores.
 */
export interface SpecificationManifest {
  readonly specId: string;
  readonly slug: string;
  readonly title: string;
  readonly type: string;
  readonly status: string;
  readonly location: SpecificationLocation;
  readonly priority?: number;
  readonly created?: string;
  readonly tasks: readonly unknown[];
}

export interface SpecificationScaffoldInput {
  readonly specId: string;
  readonly title: string;
  /** An explicit creation date supplied by the application operation. */
  readonly created: string;
  readonly goal?: string;
}

export interface SpecificationScaffoldFile {
  readonly relativePath: string;
  readonly content: string;
  /** Baseline for later admission of known Engine-created dirty files (SC00). */
  readonly sha256: string;
}

export interface SpecificationScaffold {
  readonly specId: string;
  readonly slug: string;
  readonly files: readonly SpecificationScaffoldFile[];
}

const SPEC_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9._-]*$/u;
// Windows device names are reserved even with an extension (e.g. con.txt).
// Reject on every host, not only when running on Windows.
const WINDOWS_DEVICE_PATTERN = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/u;

export function isValidSpecificationId(value: unknown): value is string {
  return typeof value === 'string' && SPEC_ID_PATTERN.test(value);
}

export function validateSpecificationSlug(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !SLUG_PATTERN.test(value) ||
    value.includes('..') ||
    value.endsWith('.') ||
    WINDOWS_DEVICE_PATTERN.test(value) ||
    value.length > 128
  ) {
    throw new SpecificationError(
      'SPEC_VALIDATION_ERROR',
      'Specification slug must be portable: lowercase ASCII, no traversal, trailing dot or Windows reserved device name.',
    );
  }
  return value;
}

export function specificationSlugFromTitle(title: string, specId: string): string {
  const normalized = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/ł/gu, 'l')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 80)
    .replace(/-+$/gu, '');
  const candidate = normalized || 'spec-' + specId.slice(0, 8);
  return validateSpecificationSlug(
    WINDOWS_DEVICE_PATTERN.test(candidate) ? candidate + '-' + specId.slice(0, 8) : candidate,
  );
}

/** Parse either supported manifest shape without inferring a status or workflow mode. */
export function parseSpecificationManifest(
  source: unknown,
  slug: string,
  location: SpecificationLocation,
): SpecificationManifest {
  validateSpecificationSlug(slug);
  if (!isRecord(source)) {
    throw new SpecificationError('SPEC_SOURCE_INVALID', 'Specification manifest is not an object.');
  }
  if (source.id !== slug || !isValidSpecificationId(source.spec_id)) {
    throw new SpecificationError(
      'SPEC_SOURCE_INVALID',
      'Manifest id/slug mismatch or missing persisted spec_id.',
    );
  }
  if (
    typeof source.title !== 'string' ||
    !source.title.trim() ||
    typeof source.status !== 'string' ||
    !source.status.trim() ||
    typeof source.type !== 'string' ||
    !source.type.trim() ||
    !Array.isArray(source.tasks)
  ) {
    throw new SpecificationError(
      'SPEC_SOURCE_INVALID',
      'Manifest must declare title, type, status and a tasks array.',
    );
  }
  if (
    (source.priority !== undefined &&
      (typeof source.priority !== 'number' || !Number.isFinite(source.priority))) ||
    (source.created !== undefined && typeof source.created !== 'string')
  ) {
    throw new SpecificationError(
      'SPEC_SOURCE_INVALID',
      'Manifest priority or creation date has an invalid type.',
    );
  }
  return {
    specId: source.spec_id,
    slug,
    title: source.title,
    type: source.type,
    status: source.status,
    location,
    ...(source.priority !== undefined ? { priority: source.priority } : {}),
    ...(source.created !== undefined ? { created: source.created } : {}),
    tasks: source.tasks,
  };
}

/**
 * Deterministic, side-effect-free title-only scaffold. It does not reserve an ID,
 * create files, update a registry or regenerate indexes. E2.T04 owns those effects.
 */
export function createSpecificationScaffold(
  input: SpecificationScaffoldInput,
): SpecificationScaffold {
  return renderSpecificationScaffold(input, false);
}

/**
 * Replay ONLY: immutable Create v1/v2 journals written before the manifest
 * filename and workflow-mode change must reproduce the exact original bytes.
 * Do not use this renderer to initiate new Specifications.
 */
export function createLegacySpecificationScaffold(
  input: SpecificationScaffoldInput,
): SpecificationScaffold {
  return renderSpecificationScaffold(input, true);
}

function renderSpecificationScaffold(
  input: SpecificationScaffoldInput,
  legacy: boolean,
): SpecificationScaffold {
  if (!isValidSpecificationId(input.specId)) {
    throw new SpecificationError('SPEC_VALIDATION_ERROR', 'A canonical specId is required.');
  }
  validateSpecificationScaffoldInput(input);
  const title = input.title.replace(/\s+/gu, ' ').trim();
  const slug = specificationSlugFromTitle(title, input.specId);
  const base = 'specs/active/' + slug + '/';
  const manifest = stringify({
    id: slug,
    title,
    type: 'standard',
    status: 'draft',
    priority: 10,
    created: input.created,
    ...(legacy ? { workflow: { mode: 'deterministic' } } : {}),
    tasks: [],
    spec_id: input.specId,
  });
  const goal = input.goal?.trim();
  const overview = [
    '---',
    'id: spec.' + slug,
    'type: change',
    'title: ' + JSON.stringify(title),
    'status: draft',
    'change: ' + slug,
    '---',
    '',
    '# ' + title,
    '',
    '## Context',
    '',
    '## Goal',
    '',
    goal?.length ? goal : 'Describe the intended outcome of this specification.',
    '',
    '## Non-goals',
    '',
    '## Constraints',
    '',
    '## Affected Areas',
    '',
    '## Acceptance Criteria & Verification',
    '',
  ].join('\n');

  return {
    specId: input.specId,
    slug,
    files: [
      fingerprint(base + (legacy ? 'change.yaml' : 'specification.yaml'), manifest),
      fingerprint(base + 'overview.md', overview),
    ],
  };
}

function fingerprint(relativePath: string, content: string): SpecificationScaffoldFile {
  return {
    relativePath,
    content,
    sha256: createHash('sha256').update(content, 'utf8').digest('hex'),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validate a create intent without allocating a speculative specification identity. */
export function validateSpecificationScaffoldInput(
  input: Pick<SpecificationScaffoldInput, 'title' | 'created'>,
): void {
  const title = input.title.replace(/\s+/gu, ' ').trim();
  if (!title || title.length > 200) {
    throw new SpecificationError('SPEC_VALIDATION_ERROR', 'Title must be 1 to 200 characters.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(input.created)) {
    throw new SpecificationError('SPEC_VALIDATION_ERROR', 'Creation date must use YYYY-MM-DD.');
  }
}
