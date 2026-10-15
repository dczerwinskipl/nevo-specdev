import type { Meta, StoryObj } from '@storybook/react-vite';
import { MarkdownDocument } from './MarkdownDocument';

const sample = `# Design system document

A reusable Markdown renderer uses **existing typography roles** and [safe links](https://example.com).

## Lists and task state

- Compact document rhythm
- Existing semantic tokens
- [x] Read-only completed task
- [ ] Read-only pending task

### Code

Inline \`code\` stays compact.

\`\`\`ts
export function resolve(value: number) {
  return Math.max(0, value);
}
\`\`\`

> Blockquotes use the existing muted-content hierarchy.

| Item | State |
| --- | --- |
| Parser | Ready |
| Styling | Ready |
`;

const meta = {
  title: 'Nevo UI/Content/MarkdownDocument',
  component: MarkdownDocument,
  args: {
    source: sample,
  },
} satisfies Meta<typeof MarkdownDocument>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Narrow: Story = {
  render: (args) => (
    <div className="w-[26rem] max-w-full">
      <MarkdownDocument {...args} />
    </div>
  ),
};

export const RawHtmlIsNotEnabled: Story = {
  args: {
    source: '<script>alert("nope")</script>\n\n<strong>Raw HTML is not enabled.</strong>',
  },
};

export const ProductLinkRenderer: Story = {
  args: {
    source:
      'Open [src/app.ts](./src/app.ts) in the contextual file preview, or visit [docs](https://example.com).',
    renderLink: ({ children, href, title }) =>
      href?.startsWith('./') ? (
        <button
          className="text-content-link underline underline-offset-2 hover:text-content-link-hover"
          data-workspace-reference={href}
          title={title}
          type="button"
        >
          {children}
        </button>
      ) : undefined,
  },
};

export const EmbeddedUnderViewTitle: Story = {
  args: { source: '# Section below a view title\n\n## Subsection', headingOffset: 1 },
};
