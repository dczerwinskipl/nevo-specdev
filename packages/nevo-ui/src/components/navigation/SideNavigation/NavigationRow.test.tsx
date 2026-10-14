import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NavigationRow } from './NavigationRow';
describe('Navigation row', () => {
  it('preserves its default marker and opts into surface-only selection', () => {
    const props = {
      active: true,
      label: 'Overview',
      renderLink: (children: import('react').ReactNode, className: string) => (
        <a href="/" className={className}>
          {children}
        </a>
      ),
    };
    expect(renderToStaticMarkup(<NavigationRow {...props} />)).toContain('bg-action-primary');
    const surface = renderToStaticMarkup(<NavigationRow {...props} selectionTreatment="surface" />);
    expect(surface).not.toContain('bg-action-primary');
    expect(surface).toContain('bg-surface-selected');
    expect(surface).toContain('font-semibold');
  });
  it('keeps route/disclosure siblings and leaves collapsed content inert', () => {
    const html = renderToStaticMarkup(
      <NavigationRow
        label="Sessions"
        renderLink={(children, className) => (
          <a className={className} href="/sessions">
            {children}
          </a>
        )}
        disclosure={{
          expanded: false,
          label: 'Expand sessions',
          onToggle: () => undefined,
          content: <a href="/session/1">Session one</a>,
        }}
      />,
    );
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('inert=""');
    expect(html).not.toMatch(/<a[^>]*>(?:(?!<\/a>)[\s\S])*<button/);
  });
});
