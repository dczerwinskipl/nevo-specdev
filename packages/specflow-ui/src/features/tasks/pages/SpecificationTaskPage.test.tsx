import { QueryClientProvider } from '@tanstack/react-query';
import { HttpClientError } from '@nevo/http-client';
import { AppShell } from '@nevo/ui';
import type { SpecificationTaskResponse } from '@nevo/specflow-contracts/specs/workspace';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createSpecFlowQueryClient } from '../../../app/queryClient';
import { LocalizationProvider } from '../../../i18n';
import { createSpecFlowAppServices } from '../../../services';
import { TestServicesRouterContext } from '../../../../test-support/app/TestServicesRouterContext';
import { taskKeys } from '../queries';
import { mapFullTaskResponse } from '../model';
import { SpecificationTaskPage } from './SpecificationTaskPage';
import { useSpecificationTask } from '../useSpecificationTask';

const specId = 'admission';
const taskId = 'TASK-77';
const detail: SpecificationTaskResponse = {
  task: {
    id: taskId,
    title: 'Independently readable Task',
    status: { id: 'pending', label: 'Pending', lifecycle: 'pending' },
  },
  purpose: 'Available without a Workspace collection',
  acceptanceCriteria: ['Can open directly'],
};

function renderTask(options: { error?: HttpClientError; seedDetail?: boolean } = {}) {
  const queryClient = createSpecFlowQueryClient();
  if (options.error) {
    const query = queryClient.getQueryCache().build(queryClient, {
      queryKey: taskKeys.detail(specId, taskId),
    });
    query.setState({
      status: 'error',
      error: options.error,
      fetchStatus: 'idle',
      errorUpdateCount: 1,
    });
  } else if (options.seedDetail !== false) {
    queryClient.setQueryData(taskKeys.detail(specId, taskId), detail);
  }
  function TaskHarness() {
    const taskState = useSpecificationTask(specId, taskId);
    return (
      <SpecificationTaskPage
        specId={specId}
        taskId={taskId}
        collection="archive"
        taskState={taskState}
        onBack={() => undefined}
      />
    );
  }
  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <TestServicesRouterContext services={createSpecFlowAppServices()}>
        <LocalizationProvider>
          <AppShell navigation={<div>Nav</div>}>
            <TaskHarness />
          </AppShell>
        </LocalizationProvider>
      </TestServicesRouterContext>
    </QueryClientProvider>,
  );
}

describe('direct Full Task page', () => {
  it('maps the authoritative detail without Task group/list fields', () => {
    const mapped = mapFullTaskResponse(detail);
    expect(mapped).toMatchObject({
      id: taskId,
      title: detail.task.title,
      purpose: detail.purpose,
      statusCode: 'pending',
    });
    expect(mapped).not.toHaveProperty('group');
  });

  it('shows Task content without a seeded Workspace query and keeps archive return context', () => {
    const markup = renderTask();
    expect(markup).toContain('Independently readable Task');
    expect(markup).toContain('Available without a Workspace collection');
    expect(markup).toContain('/specs/admission?collection=archive');
    expect(markup).not.toContain('Task not found');
  });

  it('distinguishes a domain 404 from an unavailable source', () => {
    const notFound = new HttpClientError('Not found', {
      kind: 'http',
      status: 404,
      data: { error: 'specification_task_not_found' },
    });
    const unavailable = new HttpClientError('Unavailable', {
      kind: 'http',
      status: 503,
      data: { error: 'specification_source_unavailable' },
    });
    const missingMarkup = renderTask({ error: notFound });
    const unavailableMarkup = renderTask({ error: unavailable });
    expect(missingMarkup).toContain('TASK-77');
    expect(missingMarkup).not.toEqual(unavailableMarkup);
    expect(missingMarkup).toContain('role="alert"');
    expect(unavailableMarkup).toContain('role="alert"');
  });

  it('shows forbidden Task resources as access denied, not as unavailable', () => {
    const forbidden = new HttpClientError('Forbidden', { kind: 'http', status: 403 });
    const markup = renderTask({ error: forbidden });
    expect(markup).toContain('Access denied');
    expect(markup).not.toContain('Specification is unavailable');
  });

  it('does not infer absence from a pending detail request', () => {
    const markup = renderTask({ seedDetail: false });
    expect(markup).toContain('role="status"');
    expect(markup).not.toContain('Task not found');
  });
});
