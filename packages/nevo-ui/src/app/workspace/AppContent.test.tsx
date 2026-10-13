import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppContentContainer, AppContentScrollProvider, AppWorkspaceBody } from './AppContent';

describe('AppContentContainer', () => {
  it('authors a preferred width and clamps it to the workspace slot', () => {
    const html = renderToStaticMarkup(
      <AppContentContainer align="start" size="wide">
        Content
      </AppContentContainer>,
    );

    expect(html).toContain('w-content-wide');
    expect(html).toContain('max-w-full');
    expect(html).not.toContain('mx-auto');
  });

  it('uses the standard centered content width by default', () => {
    const html = renderToStaticMarkup(<AppContentContainer>Content</AppContentContainer>);

    expect(html).toContain('w-content-standard');
    expect(html).toContain('mx-auto');
  });
});

describe('AppWorkspaceBody scroll ownership', () => {
  it('uses the shared ScrollArea when requested by a desktop surface', () => {
    const markup = renderToStaticMarkup(
      <AppWorkspaceBody scroll="area" aria-label="Materials">
        Content
      </AppWorkspaceBody>,
    );
    expect(markup).toContain('scroll-area-viewport');
    expect(markup).toContain('scroll-area-indicator-bottom');
    expect(markup).toContain('aria-label="Materials"');
  });
  it('leaves scrolling to the stacked workspace host', () => {
    const markup = renderToStaticMarkup(
      <AppContentScrollProvider>
        <AppWorkspaceBody scroll="area">Content</AppWorkspaceBody>
      </AppContentScrollProvider>,
    );
    expect(markup).not.toContain('scroll-area-viewport');
    expect(markup).toContain('Content');
    expect(markup).not.toContain('tabindex');
  });
});
