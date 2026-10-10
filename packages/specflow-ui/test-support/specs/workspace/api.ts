import type { SpecificationApi } from '../../../src/features/specs/api';
import type { TaskApi } from '../../../src/features/tasks/api';
import type { DocumentApi } from '../../../src/features/documents/api';
import type { SpecificationWorkspaceResponse } from '@nevo/specflow-contracts/specs/workspace';

/** Story-only typed API responses. The route still runs real Query + DTO mapper. */
export function createWorkspaceIntegrationApi(): SpecificationApi {
  const snapshot: SpecificationWorkspaceResponse = {
    revision: 'integration-story-1',
    specification: {
      id: 'api-integration',
      title: 'Integrated API Workspace',
      summary: 'This screen comes from an HTTP-shaped DTO through the real mapper.',
      preparationState: 'prepared',
      attention: [],
    },
    sections: {
      tasks: {
        state: 'available',
        data: {
          groups: [
            {
              id: 'implementation',
              name: 'Integration tasks',
              tasks: [
                {
                  id: 'TASK-01',
                  title: 'Initial task summary',
                  status: { id: 'in_progress', label: 'In progress', lifecycle: 'in_progress' },
                },
              ],
            },
          ],
          total: 1,
          completed: 0,
          attention: [],
        },
      },
      documents: {
        state: 'available',
        data: { items: [{ id: 'spec', title: 'Integration document', kind: 'markdown' }] },
      },
      sessions: { state: 'available', data: { items: [], attention: [] } },
      activity: { state: 'available', data: { items: [] } },
      changes: { state: 'unavailable', reason: 'not_implemented' },
      repository: { state: 'unavailable', reason: 'not_implemented' },
    },
    actions: {
      executeTasks: { available: false, reason: 'not_implemented' },
      startSession: { available: false, reason: 'not_implemented' },
    },
  };
  return {
    getSpecificationWorkspace: (specId, signal) => {
      signal?.throwIfAborted();
      return specId === snapshot.specification.id
        ? Promise.resolve(snapshot)
        : Promise.reject(new Error('Unconfigured test Specification'));
    },
  };
}

/** Story-only Task detail adapter, separate from Specification Workspace reads. */
export function createTaskIntegrationApi(): TaskApi {
  return {
    getTask: (specId, taskId, signal) => {
      signal?.throwIfAborted();
      if (specId !== 'api-integration' || taskId !== 'TASK-01') {
        return Promise.reject(new Error('Unexpected test Task'));
      }
      return Promise.resolve({
        task: {
          id: taskId,
          title: 'Fresh task detail from Runtime API',
          status: { id: 'completed', label: 'Completed', lifecycle: 'completed' },
        },
        purpose: 'Latest purpose loaded independently from the detail endpoint.',
        acceptanceCriteria: ['Latest acceptance criterion'],
      });
    },
  };
}

export function createDocumentIntegrationApi(): DocumentApi {
  return {
    getDocument: (specId, documentId, signal) => {
      signal?.throwIfAborted();
      if (specId !== 'api-integration' || documentId !== 'spec') {
        return Promise.reject(new Error('Unexpected test document'));
      }
      return Promise.resolve({
        id: documentId,
        title: 'Integration document',
        content: '# Document content from Runtime detail API\n\nDetail query loaded successfully.',
        revision: 'integration-doc-2',
      });
    },
  };
}
