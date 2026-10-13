import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createSpecFlowI18n, LocalizationProvider } from '../../../i18n';
import { TaskHistoryDetails } from './TaskHistoryDetails';
import { createHistoryDetailsFixture } from './taskHistoryDetails.test-support';

describe('Historical detail hierarchy', () => {
  it('leads with usable materials and keeps raw identity/provenance behind a named entry', () => {
    const entry = createHistoryDetailsFixture();
    const html = renderToStaticMarkup(
      <LocalizationProvider instance={createSpecFlowI18n('en')}>
        <TaskHistoryDetails
          entry={entry}
          taskId="TASK-03"
          token="token"
          revision="revision"
          onOpenResource={vi.fn()}
        />
      </LocalizationProvider>,
    );
    expect(html).toContain('Available historical document');
    expect(html).toContain('Technical data');
    expect(html).toContain('Full historical context unavailable');
    expect(html).not.toContain('legal-material-id');
    expect(html).not.toContain('workflow_history');
    expect(html).not.toContain('Secret material title');
    expect(html).not.toContain('secret-material-id');
    expect(html).not.toContain('secret-source');
    expect(html).toContain('Restricted material');
    expect(html).toContain('Access restricted');
  });
  it('omits confirmed empty optional collections without hiding source limitations', () => {
    const entry = createHistoryDetailsFixture();
    entry.step.hints = [];
    entry.resources = [];
    entry.provenance = [];
    const html = renderToStaticMarkup(
      <LocalizationProvider instance={createSpecFlowI18n('en')}>
        <TaskHistoryDetails entry={entry} taskId="TASK-03" token="token" revision="revision" />
      </LocalizationProvider>,
    );
    expect(html).not.toContain('Hints');
    expect(html).not.toContain('Related resources');
    expect(html).not.toContain('Provenance');
    expect(html).toContain('Full historical context unavailable');
  });
});
