import { QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createSpecFlowQueryClient } from '../../../app/queryClient';
import { createSpecFlowAppServices } from '../../../services';
import { TestServicesRouterContext } from '../../../../test-support/app/TestServicesRouterContext';
import { taskKeys } from '../../tasks/queries';
import { createSpecificationWorkspaceFixture } from '../../../../test-support/specs/workspace/fixtures';
import {
  SpecificationSecondaryDataContext,
  useTaskPreviewData,
  taskPreviewFailure,
} from './specificationSecondaryStack';

const specId = 'admission';
const taskId = 'TASK-77';

function PreviewStatus() {
  const preview = useTaskPreviewData({ specId, taskId });
  return <span>{preview.status === 'ready' ? preview.data.task.title : preview.status}</span>;
}

describe('Task preview by identity', () => {
  it('uses the Task detail API/cache when a Task is missing from Workspace groups', () => {
    const queryClient = createSpecFlowQueryClient();
    queryClient.setQueryData(taskKeys.detail(specId, taskId), {
      task: {
        id: taskId,
        title: 'Referenced outside Task list',
        status: { id: 'pending', label: 'Pending', lifecycle: 'pending' },
      },
      acceptanceCriteria: [],
    });
    const data = { ...createSpecificationWorkspaceFixture('working', specId), taskGroups: [] };
    const markup = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <TestServicesRouterContext services={createSpecFlowAppServices()}>
          <SpecificationSecondaryDataContext.Provider
            value={{
              specId,
              data,
              openFullTask: () => undefined,
              previewTask: () => undefined,
            }}
          >
            <PreviewStatus />
          </SpecificationSecondaryDataContext.Provider>
        </TestServicesRouterContext>
      </QueryClientProvider>,
    );
    expect(markup).toContain('Referenced outside Task list');
    expect(markup).not.toContain('unavailable');
  });
});

describe('Task Preview HTTP failure states', () => {
  it('keeps expired authentication distinct and retryable', () => {
    const retry = vi.fn();
    const state = taskPreviewFailure(401, false, taskId, retry);
    expect(state.status).toBe('error');
    if (state.status !== 'error') throw new Error('Expected retryable error');
    expect(state.message).toContain('session');
    state.retry?.();
    expect(retry).toHaveBeenCalledOnce();
  });

  it('shows access denied without rendering or retrying the Task', () => {
    const state = taskPreviewFailure(403, false, taskId, vi.fn());
    expect(state.status).toBe('access-denied');
    expect(state).not.toHaveProperty('retry');
  });

  it('treats only domain-confirmed 404 as not found', () => {
    const retry = vi.fn();
    const absent = taskPreviewFailure(404, true, taskId, retry);
    expect(absent.status).toBe('unavailable');
    expect(absent.status === 'unavailable' ? absent.message : '').toContain(taskId);
    const unexpected = taskPreviewFailure(404, false, taskId, retry);
    expect(unexpected.status).toBe('error');
  });

  it('keeps temporary Runtime failures retryable', () => {
    const retry = vi.fn();
    const state = taskPreviewFailure(503, false, taskId, retry);
    expect(state.status).toBe('error');
    if (state.status !== 'error') throw new Error('Expected recoverable error');
    state.retry?.();
    expect(retry).toHaveBeenCalledOnce();
  });
});
