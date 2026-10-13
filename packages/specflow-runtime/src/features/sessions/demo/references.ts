import type { DemoCatalogue } from '../../demo-catalogue';
import type { SessionReferenceOwner } from '../reference-owner';
export function createDemoSessionReferences(catalogue: DemoCatalogue): SessionReferenceOwner {
  return {
    async resolve(sessionId) {
      const records = await catalogue.all();
      for (const record of records)
        if (
          record.currentExecutions?.some((item) => item.sessionId === sessionId) ||
          record.signals?.some(
            (item) => item.target.kind === 'session' && item.target.sessionId === sessionId,
          )
        )
          return {
            sessionId,
            specId: record.id,
            projectId: 'demo-project',
            workspaceId: 'demo-workspace',
          };
      return null;
    },
  };
}
