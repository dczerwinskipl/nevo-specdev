import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { StoryLocalization } from '../../../i18n/StoryLocalization';
import { SessionNavigationPreview } from './SessionNavigationPreview';
describe('Sessions navigation presentation', () => {
  it('keeps provided identity and communicates typed states through text and static shapes', () => {
    const html = renderToStaticMarkup(
      <StoryLocalization locale="en">
        <SessionNavigationPreview
          entries={[
            {
              id: 'raw-role-task-key',
              title: 'Provided generic session title',
              activityCode: 'attention',
            },
            { id: 'active', title: 'Implement · TASK-04', activityCode: 'active' },
          ]}
        >
          <a href="/sessions">View all sessions</a>
        </SessionNavigationPreview>
      </StoryLocalization>,
    );
    expect(html).toContain('Provided generic session title');
    expect(html).toContain('Needs your attention');
    expect(html).toContain('Active');
    expect(html).toContain('message-circle-warning');
    expect(html).toContain('lucide-circle');
    expect(html).toContain('text-status-attention');
    expect(html).toContain('text-status-info');
    expect(html).not.toContain('Waiting for your reply');
    expect(html).not.toContain('Agent running');
    expect(html).not.toContain('animate-spin');
    expect(html).not.toContain('raw-role-task-key');
  });
});
