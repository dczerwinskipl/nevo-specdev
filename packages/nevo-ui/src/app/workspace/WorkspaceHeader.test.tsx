import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import {
  WorkspaceHeader,
  WorkspaceHeaderFrame,
  WorkspaceHeaderIdentity,
  resolveWorkspaceHeaderActions,
  getWorkspaceHeaderActions,
  type WorkspaceHeaderAction,
} from './WorkspaceHeader';

const actions: WorkspaceHeaderAction[] = [
  {
    id: 'create',
    label: 'New customer',
    icon: 'plus',
    primary: true,
    disabled: true,
    onPress: vi.fn(),
  },
  { id: 'export', label: 'Export', icon: 'file', onPress: vi.fn() },
  {
    id: 'delete',
    label: 'Delete',
    icon: 'trash',
    primary: true,
    tone: 'danger',
    onPress: vi.fn(),
  },
];

describe('WorkspaceHeader actions', () => {
  it('keeps structured location outside heading semantics while retaining compact actions', () => {
    const header = (
      <WorkspaceHeader
        title="Overview"
        as="span"
        identityContent={
          <nav aria-label="Location">
            <span aria-current="page">Overview</span>
          </nav>
        }
        actions={actions}
      />
    );
    expect(getWorkspaceHeaderActions(header)).toEqual(actions);
    const html = renderToStaticMarkup(header);
    expect(html).toContain('aria-label="Location"');
    expect(html).not.toMatch(/<h[1-6]/);
    expect(html).toContain('New customer');
  });
  it('automatically renders declared actions beside custom identity exactly once', () => {
    const markup = renderToStaticMarkup(
      <WorkspaceHeaderFrame
        content={<WorkspaceHeaderIdentity headingLevel={2} title="Inspector" />}
        actions={actions}
      />,
    );

    expect(markup).toContain('data-workspace-header="true"');
    expect(markup).toContain('<h2');
    expect(markup).toContain('aria-label="New customer"');
    expect((markup.match(/aria-label="New customer"/g) ?? []).length).toBe(1);
  });

  it('selects at most one non-danger primary and preserves disabled semantics', () => {
    const resolved = resolveWorkspaceHeaderActions(actions);

    expect(resolved.directPrimary).toMatchObject({ id: 'create', disabled: true });
    expect(resolved.overflow.map((action) => action.id)).toEqual(['export', 'delete']);
    expect(resolved.overflow.at(-1)).toMatchObject({ tone: 'danger' });
  });

  it('moves every page action into overflow in compact presentation', () => {
    const resolved = resolveWorkspaceHeaderActions(actions, true);

    expect(resolved.directPrimary).toBeUndefined();
    expect(resolved.overflow).toEqual(actions);
  });

  it('keeps an accessible label on the icon-only primary representation', () => {
    const markup = renderToStaticMarkup(
      <WorkspaceHeader actions={actions} subtitle="5 accounts" title="Customers" />,
    );

    expect(markup).toContain('aria-label="New customer"');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('data-workspace-header-title="true"');
  });

  it('allows generated overflow copy to be localized', () => {
    const markup = renderToStaticMarkup(
      <WorkspaceHeader
        actions={actions}
        labels={{ moreActions: 'Więcej działań' }}
        title="Klienci"
      />,
    );

    expect(markup).toContain('aria-label="Więcej działań"');
  });
});
