import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createSpecFlowI18n, LocalizationProvider } from '../../../i18n';
import { mapFullTaskResponse } from '../model';
import { TaskEvidenceInspection } from './TaskInspection';
import { createTaskDetailFixture } from './taskDetail.test-support';

vi.mock('../../documents/connected/DocumentContent', () => ({
  DocumentContent: ({ documentId }: { documentId: string }) => <div>Reader {documentId}</div>,
}));
describe('Pinned evidence inspector', () => {
  it('does not substitute report B when visibility removes an earlier evidence row', () => {
    const { response } = createTaskDetailFixture();
    const snapshot = response.snapshot!,
      requirements = snapshot.sections.humanRequirements;
    if (requirements.state !== 'available') throw Error('Expected requirements');
    const report = (documentId: string) => ({
      title: documentId,
      link: {
        state: 'available' as const,
        target: { kind: 'document' as const, specId: 'admission', documentId, revision: 'v1' },
      },
    });
    requirements.data.items[0]!.evidence = [
      {
        title: 'Session',
        link: { state: 'available', target: { kind: 'session', sessionId: 'session' } },
      },
      report('report-A'),
      report('report-B'),
    ];
    snapshot.revision = 'visible-with-session';
    const params = {
      requirementId: requirements.data.items[0]!.id,
      index: 1,
      revision: snapshot.revision,
    };
    const render = () =>
      renderToStaticMarkup(
        <LocalizationProvider instance={createSpecFlowI18n('en')}>
          <TaskEvidenceInspection task={mapFullTaskResponse(response)} params={params} />
        </LocalizationProvider>,
      );
    expect(render()).toContain('Reader report-A');
    requirements.data.items[0]!.evidence.shift();
    snapshot.revision = 'visible-without-session';
    const html = render();
    expect(html).toContain('This source is unavailable.');
    expect(html).not.toContain('Reader report-B');
    expect(html).not.toContain('Reader report-A');
  });
});
