import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { InformationList } from './InformationList';

describe('InformationList', () => {
  it('renders ul list container with parent-owned divide-y and without per-row borders', () => {
    const html = renderToStaticMarkup(
      <InformationList>
        <InformationList.Item>
          <InformationList.Content>
            <span>Item 1</span>
          </InformationList.Content>
        </InformationList.Item>
        <InformationList.Item>
          <InformationList.Content>
            <span>Item 2</span>
          </InformationList.Content>
        </InformationList.Item>
      </InformationList>,
    );

    expect(html).toContain('<ul');
    expect(html).toContain('divide-y');
    expect(html).toContain('divide-border-subtle');
    expect(html.match(/<li/g)).toHaveLength(2);
    expect(html).not.toContain('border-b');
  });

  it('renders leading rail only when InformationList.Leading is present', () => {
    const withoutLeading = renderToStaticMarkup(
      <InformationList>
        <InformationList.Item>
          <InformationList.Content>
            <span>No leading</span>
          </InformationList.Content>
        </InformationList.Item>
      </InformationList>,
    );

    expect(withoutLeading).not.toContain('w-control-height-compact');

    const withLeading = renderToStaticMarkup(
      <InformationList selectable>
        <InformationList.Item>
          <InformationList.Leading>
            <input type="checkbox" aria-label="Select row" />
          </InformationList.Leading>
          <InformationList.Content>
            <span>With leading</span>
          </InformationList.Content>
        </InformationList.Item>
      </InformationList>,
    );

    expect(withLeading).toContain('w-control-height-compact');
    expect(withLeading).toContain('relative');
    expect(withLeading).toContain('z-10');
    expect(withLeading).toContain('type="checkbox"');
  });

  it('renders trailing rail only when InformationList.Trailing is present', () => {
    const withoutTrailing = renderToStaticMarkup(
      <InformationList>
        <InformationList.Item>
          <InformationList.Content>
            <span>No trailing</span>
          </InformationList.Content>
        </InformationList.Item>
      </InformationList>,
    );

    expect(withoutTrailing).not.toContain('button');

    const withTrailing = renderToStaticMarkup(
      <InformationList>
        <InformationList.Item>
          <InformationList.Content>
            <span>With trailing</span>
          </InformationList.Content>
          <InformationList.Trailing>
            <button type="button">Action</button>
          </InformationList.Trailing>
        </InformationList.Item>
      </InformationList>,
    );

    expect(withTrailing).toContain('button');
  });

  it('applies interactive and selected classes', () => {
    const html = renderToStaticMarkup(
      <InformationList>
        <InformationList.Item interactive selected>
          <InformationList.Content>
            <span>Active item</span>
          </InformationList.Content>
        </InformationList.Item>
      </InformationList>,
    );

    expect(html).toContain('hover:bg-surface-hover');
    expect(html).toContain('bg-surface-selected/40');
  });
});
