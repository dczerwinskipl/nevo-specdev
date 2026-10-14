import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MarkdownDocument } from './MarkdownDocument';

describe('MarkdownDocument', () => {
  it('embeds headings below an owning title without changing their visual styles', () => {
    const source = '# Section\n\n## Subsection\n\n###### Deep section';
    const standalone = renderToStaticMarkup(<MarkdownDocument source={source} />);
    const embedded = renderToStaticMarkup(<MarkdownDocument source={source} headingOffset={1} />);
    expect(standalone).toContain('<h1');
    expect(embedded).not.toContain('<h1');
    expect(embedded).toContain('<h2');
    expect(embedded).toContain('<h3');
    expect(embedded).toContain('<h6');
    expect(embedded.match(/class="[^"]*"/g)).toEqual(standalone.match(/class="[^"]*"/g));
  });
  it('supports GFM and safe external links', () => {
    const html = renderToStaticMarkup(
      <MarkdownDocument
        source={'[Open](https://example.com)\n\n- [x] Done\n\n| A | B |\n| - | - |\n| 1 | 2 |'}
      />,
    );

    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer noopener"');
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-label="Completed task"');
    expect(html).toContain('<table');
  });

  it('allows product code to resolve Markdown links contextually', () => {
    const html = renderToStaticMarkup(
      <MarkdownDocument
        renderLink={({ children, href }) => (
          <button data-workspace-reference={href} type="button">
            {children}
          </button>
        )}
        source={'[Open file](./src/app.ts)'}
      />,
    );

    expect(html).toContain('data-workspace-reference="./src/app.ts"');
    expect(html).toContain('>Open file</button>');
    expect(html).not.toContain('target="_blank"');
  });

  it('falls back to the shared external link when the product renderer does not claim a link', () => {
    const html = renderToStaticMarkup(
      <MarkdownDocument
        renderLink={({ href }) =>
          href?.startsWith('./') ? <button type="button">Local</button> : undefined
        }
        source={'[Docs](https://example.com)'}
      />,
    );

    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer noopener"');
    expect(html).toContain('>Docs</');
  });

  it('does not enable raw HTML', () => {
    const html = renderToStaticMarkup(<MarkdownDocument source={'<script>alert("x")</script>'} />);

    expect(html).not.toContain('<script>');
  });

  it('allows generated task labels to be localized', () => {
    const html = renderToStaticMarkup(
      <MarkdownDocument
        labels={{ completedTask: 'Zadanie ukończone', incompleteTask: 'Zadanie nieukończone' }}
        source={'- [x] Done\n- [ ] Pending'}
      />,
    );

    expect(html).toContain('aria-label="Zadanie ukończone"');
    expect(html).toContain('aria-label="Zadanie nieukończone"');
  });
});
