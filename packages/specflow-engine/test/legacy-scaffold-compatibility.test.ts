import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { createSpecificationScaffold } from '../src/testing';

/**
 * Frozen PRE-T09 byte fixture. Do not regenerate this constant with the
 * currently installed scaffold implementation, even after the migration.
 * Durable Create v1/v2 used these exact bytes and SHA-256 values.
 */
export const historicalScaffold = {
  specId: '11111111-1111-4111-8111-111111111111',
  title: 'Historical spec',
  created: '2026-10-14',
  goal: 'Audit old bytes',
} as const;

const expectedManifest = [
  'id: historical-spec',
  'title: Historical spec',
  'type: standard',
  'status: draft',
  'priority: 10',
  'created: 2026-10-14',
  'workflow:',
  '  mode: deterministic',
  'tasks: []',
  'spec_id: 11111111-1111-4111-8111-111111111111',
  '',
].join('\n');

const expectedOverview = [
  '---',
  'id: spec.historical-spec',
  'type: change',
  'title: "Historical spec"',
  'status: draft',
  'change: historical-spec',
  '---',
  '',
  '# Historical spec',
  '',
  '## Context',
  '',
  '## Goal',
  '',
  'Audit old bytes',
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

describe('E2.T09 checkpoint 1: frozen pre-migration Create scaffold bytes', () => {
  it('preserves the exact historical manifest and overview fingerprints', () => {
    const scaffold = createSpecificationScaffold(historicalScaffold);
    expect(scaffold.slug).toBe('historical-spec');
    expect(scaffold.files).toEqual([
      {
        relativePath: 'specs/active/historical-spec/change.yaml',
        content: expectedManifest,
        sha256: createHash('sha256').update(expectedManifest, 'utf8').digest('hex'),
      },
      {
        relativePath: 'specs/active/historical-spec/overview.md',
        content: expectedOverview,
        sha256: createHash('sha256').update(expectedOverview, 'utf8').digest('hex'),
      },
    ]);
  });
});
