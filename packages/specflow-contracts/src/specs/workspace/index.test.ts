import { Value } from 'typebox/value';
import { describe, expect, it } from 'vitest';
import { SpecificationWorkspaceResponseSchema } from './index';

function workspace() {
  return {
    revision: '1',
    specification: {
      id: 'spec-1',
      title: 'Specification',
      summary: '',
      preparationState: 'prepared',
      attention: [],
    },
    sections: {
      tasks: {
        state: 'available',
        data: { groups: [], completed: 0, total: 0, attention: [] },
      },
      documents: { state: 'unavailable', reason: 'not_implemented' },
      sessions: { state: 'available', data: { items: [], attention: [] } },
      activity: { state: 'available', data: { items: [] } },
      repository: { state: 'available', data: { attention: [] } },
      changes: { state: 'unavailable', reason: 'not_implemented' },
    },
    actions: { executeTasks: { available: false }, startSession: { available: false } },
  };
}

describe('Specification Workspace Attention contract', () => {
  it('requires a complete Attention array even when an available source has no items', () => {
    const response = workspace();
    expect(Value.Check(SpecificationWorkspaceResponseSchema, response)).toBe(true);

    for (const feature of ['tasks', 'sessions', 'repository'] as const) {
      const section = response.sections[feature];
      const data: Record<string, unknown> = { ...section.data };
      delete data.attention;
      const invalid = {
        ...response,
        sections: {
          ...response.sections,
          [feature]: { state: 'available', data },
        },
      };
      expect(Value.Check(SpecificationWorkspaceResponseSchema, invalid)).toBe(false);
    }
  });

  it('represents unsupported, temporarily unavailable and forbidden sources explicitly', () => {
    const response = workspace();
    for (const section of [
      { state: 'unavailable', reason: 'source_unavailable' },
      { state: 'unavailable', reason: 'not_implemented' },
      { state: 'forbidden' },
    ]) {
      const projection = {
        ...response,
        sections: { ...response.sections, sessions: section },
      };
      expect(Value.Check(SpecificationWorkspaceResponseSchema, projection)).toBe(true);
    }
  });
});
