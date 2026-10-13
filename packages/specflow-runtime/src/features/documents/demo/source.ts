import type { DemoCatalogue } from '../../demo-catalogue';
import type { DocumentContentSource } from '../content/read-document';
export function createDemoDocumentSource(catalogue: DemoCatalogue): DocumentContentSource {
  return {
    async read(specId, documentId, revision) {
      const record = await catalogue.find(specId);
      if (!record) return { kind: 'not_found' };
      const taskNumber = /^TASK-(\d+)$/.exec(documentId);
      const task =
        taskNumber && Number(taskNumber[1]) >= 1 && Number(taskNumber[1]) <= record.progress.total;
      if (!task && documentId !== 'spec') return { kind: 'not_found' };
      if (revision !== undefined && revision !== 'demo-document-1')
        return { kind: 'revision_unavailable' };
      const title = task ? documentId + ' · ' + record.title : 'Specification';
      const content = task
        ? '# ' +
          title +
          '\n\nDemonstration Task for ' +
          record.title +
          '\n\n## Acceptance criteria\n\n- Verify navigation and session behaviour.\n- Preserve user context.'
        : '# ' + record.title + '\n\nDemonstration Specification for ' + record.id + '.';
      return {
        kind: 'ok',
        document: { specId, id: documentId, title, content, revision: 'demo-document-1' },
      };
    },
  };
}
