import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SpecificationWorkspaceResponse } from '@nevo/specflow-contracts/specs/workspace';
import { createWorkspaceIntegrationApi } from '../../../../test-support/specs/workspace/api';
import { UiModulesProvider } from '../../../app/ui-modules/UiModulesProvider';
import { builtInUiModuleRegistry } from '../../../app/ui-modules/builtInUiModules';
import { LocalizationProvider } from '../../../i18n';
import { mapWorkspaceResponse } from './mapWorkspaceResponse';
import { SpecificationAttentionOutlet } from './SpecificationAttentionOutlet';
import { createFakeWorkspaceRuntime, WorkspaceProvider } from './WorkspaceContext';

function renderAttention(dto: SpecificationWorkspaceResponse) {
  const data = mapWorkspaceResponse(dto);
  return {
    data,
    markup: renderToStaticMarkup(
      <UiModulesProvider modules={builtInUiModuleRegistry}>
        <LocalizationProvider>
          <WorkspaceProvider runtime={createFakeWorkspaceRuntime()}>
            <SpecificationAttentionOutlet specId={dto.specification.id} data={data} />
          </WorkspaceProvider>
        </LocalizationProvider>
      </UiModulesProvider>,
    ),
  };
}

describe('Feature-owned Attention source availability', () => {
  it('treats a successful empty Session read as no Session Attention', async () => {
    const dto = await createWorkspaceIntegrationApi().getSpecificationWorkspace('api-integration');
    const { data, markup } = renderAttention(dto);
    expect(data.featureAttention?.sessions).toEqual({ state: 'available', items: [] });
    expect(markup).not.toContain('Some attention items could not be loaded');
  });

  it('warns when Session Attention cannot be established without hiding healthy Task items', async () => {
    const dto = await createWorkspaceIntegrationApi().getSpecificationWorkspace('api-integration');
    const output = renderAttention({
      ...dto,
      sections: {
        ...dto.sections,
        tasks:
          dto.sections.tasks.state === 'available'
            ? {
                state: 'available',
                data: {
                  ...dto.sections.tasks.data,
                  attention: [
                    {
                      id: 'task-review',
                      kind: 'task',
                      title: 'Task review remains visible',
                      reason: 'Review required',
                    },
                  ],
                },
              }
            : dto.sections.tasks,
        sessions: { state: 'unavailable', reason: 'source_unavailable' },
      },
    });
    expect(output.data.featureAttention?.sessions).toEqual({
      state: 'unavailable',
      reason: 'source_unavailable',
    });
    expect(output.markup).toContain('Task review remains visible');
    expect(output.markup).toContain('Some attention items could not be loaded');
  });

  it('does not reveal forbidden or unsupported Session Attention', async () => {
    const dto = await createWorkspaceIntegrationApi().getSpecificationWorkspace('api-integration');
    const states = [
      { state: 'forbidden' },
      { state: 'unavailable', reason: 'not_implemented' },
    ] as const;
    for (const state of states) {
      const output = renderAttention({
        ...dto,
        sections: { ...dto.sections, sessions: state },
      });
      expect(output.data.featureAttention?.sessions).toMatchObject(state);
      expect(output.markup).not.toContain('Some attention items could not be loaded');
      expect(output.markup).not.toContain('Session requires input');
    }
  });
});
