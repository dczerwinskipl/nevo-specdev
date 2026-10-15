import type { CurrentSpecSectionId } from '@nevo/specflow-contracts/specs/overview';

import { RuntimeConfigError } from '../../../../config/parsing/runtime-config-error';

export const DEFAULT_CURRENT_SECTIONS: readonly CurrentSpecSectionId[] = [
  'requires-attention',
  'active',
  'ready',
  'draft',
  'unknown',
];

export function parseCurrentOverviewSections(
  value: unknown,
  path = 'specs.overview.current.sections',
): CurrentSpecSectionId[] {
  if (value === undefined) return [...DEFAULT_CURRENT_SECTIONS];

  if (!Array.isArray(value)) {
    throw new RuntimeConfigError(`${path} must be an array.`);
  }

  const sections = value.map((section) => parseSection(section, path));

  if (new Set(sections).size !== sections.length) {
    throw new RuntimeConfigError(`${path} must not contain duplicates.`);
  }

  return sections;
}

function parseSection(value: unknown, path: string): CurrentSpecSectionId {
  if (
    value === 'requires-attention' ||
    value === 'active' ||
    value === 'ready' ||
    value === 'draft' ||
    value === 'unknown'
  ) {
    return value;
  }

  throw new RuntimeConfigError(`${path} contains unknown section '${String(value)}'.`);
}
