import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createSpecFlowI18n, LocalizationProvider } from '../../../i18n';
import { TaskWorkspaceState } from './TaskWorkspaceState';
import { TaskWorkspaceSessions } from './TaskWorkspaceSessions';
import type { TaskWorkspaceData } from './taskWorkspaceModel';

function render(href?: string) {
  const data: TaskWorkspaceData = {
    id: 'task-1',
    specification: 'Specification',
    title: 'Task',
    phase: 'active',
    status: { label: 'Implementation', tone: 'info', icon: 'workflow' },
    handoffs: [],
    decisions: [],
    sessions: [
      {
        id: 's-1',
        title: 'Implementation session',
        provider: 'Custom provider',
        current: true,
        step: 'Implementation',
        attempt: 1,
        status: 'waitingForUser',
        href,
      },
    ],
  };
  return renderToStaticMarkup(
    <LocalizationProvider instance={createSpecFlowI18n('en')}>
      <TaskWorkspaceState data={data}>
        <TaskWorkspaceSessions />
      </TaskWorkspaceState>
    </LocalizationProvider>,
  );
}

describe('Task session owner availability', () => {
  it('keeps the association and status readable without manufacturing a destination', () => {
    const html = render();
    expect(html).toContain('Implementation session');
    expect(html).toContain('Needs a response');
    expect(html).toContain('Full session view unavailable');
    expect(html).not.toContain('<a ');
  });
  it('uses the exact owner URL for the title and separate new-window entry', () => {
    const href = 'https://session-owner.example.test/s-1';
    const html = render(href);
    expect(html.split(`href="${href}"`)).toHaveLength(3);
    expect(html.match(/target="_blank"/g)).toHaveLength(2);
    expect(html.match(/rel="noopener noreferrer"/g)).toHaveLength(2);
    expect(html).not.toContain('Full session view unavailable');
  });
});
