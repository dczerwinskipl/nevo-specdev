import { describe, expect, it } from 'vitest';
import { appI18n } from '../../../i18n';
import { createWorkspaceIntegrationApi } from '../../../../test-support/specs/workspace/api';
import { mapWorkspaceResponse } from './mapWorkspaceResponse';
import { taskStatusLabel } from '../../tasks/status';

describe('Workspace response mapping', () => {
  it('stores semantic statuses independently of locale and translates on rendering', async () => {
    const dto = await createWorkspaceIntegrationApi().getSpecificationWorkspace('api-integration');
    const mapped = mapWorkspaceResponse(dto);
    const task = mapped.taskGroups[0]?.tasks[0];
    if (!task) throw new Error('Expected integration task');
    expect(task.statusCode).toBe('in_progress');

    await appI18n.changeLanguage('en');
    expect(taskStatusLabel(task, appI18n.t)).toBe('In progress');
    await appI18n.changeLanguage('pl');
    expect(taskStatusLabel(task, appI18n.t)).toBe('W trakcie');
    // Locale changes must not mutate a cached presentation projection.
    expect(mapped.taskGroups[0]?.tasks[0]).toBe(task);
    expect(mapped.id).toBe('api-integration');
  });
  it('keeps backend execution unavailability reason as a semantic code', async () => {
    const dto = await createWorkspaceIntegrationApi().getSpecificationWorkspace('api-integration');
    const mapped = mapWorkspaceResponse(dto);
    expect(mapped.executionReadiness).toEqual({
      canExecute: false,
      reasonCode: 'not_implemented',
      blockers: [],
    });
  });

  it('does not infer Git absence or zero documents when projections are temporarily unavailable', async () => {
    const dto = await createWorkspaceIntegrationApi().getSpecificationWorkspace('api-integration');
    const mapped = mapWorkspaceResponse({
      ...dto,
      sections: {
        ...dto.sections,
        repository: { state: 'unavailable', reason: 'source_unavailable' },
        documents: { state: 'unavailable', reason: 'source_unavailable' },
      },
    });
    expect(mapped.hasGit).toBeUndefined();
    expect(mapped.sectionAvailability?.repository).toBe('unavailable');
    expect(mapped.sectionAvailability?.documents).toBe('unavailable');
    expect(mapped.documents).toEqual([]);
  });

  it('hides Git navigation only when capability is explicitly unsupported, not on transient errors', async () => {
    const dto = await createWorkspaceIntegrationApi().getSpecificationWorkspace('api-integration');
    expect(mapWorkspaceResponse(dto).hasGit).toBe(false);

    const unavailable = mapWorkspaceResponse({
      ...dto,
      sections: {
        ...dto.sections,
        repository: { state: 'unavailable', reason: 'source_unavailable' },
      },
    });
    expect(unavailable.hasGit).toBeUndefined();
  });

  it('retains explicit forbidden availability instead of treating it as an unknown Git state', async () => {
    const dto = await createWorkspaceIntegrationApi().getSpecificationWorkspace('api-integration');
    const mapped = mapWorkspaceResponse({
      ...dto,
      sections: {
        ...dto.sections,
        repository: { state: 'forbidden' },
      },
    });
    expect(mapped.hasGit).toBe(false);
    expect(mapped.sectionAvailability?.repository).toBe('forbidden');
  });
});
