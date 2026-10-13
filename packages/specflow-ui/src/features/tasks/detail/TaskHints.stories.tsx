import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn, waitFor } from 'storybook/test';
import { StoryLocalization } from '../../../i18n/StoryLocalization';
import { TaskHints } from './TaskHints';

const hints = [
  { kind: 'file' as const, ref: `${'src/very-long-path/'.repeat(12)}session.ts` },
  { kind: 'file' as const, ref: `src/${'very-long-name-'.repeat(25)}session.ts` },
  { kind: 'skill' as const, ref: `team/${'opaque-skill-'.repeat(30)}.v2` },
  { kind: 'doc' as const, ref: 'first/shared/guide.md' },
  { kind: 'doc' as const, ref: 'second/shared/guide.md' },
  { kind: 'doc' as const, ref: 'opaque/id/without-extension' },
];
const meta = {
  title: 'SpecFlow/Features/Tasks/Hints',
  component: TaskHints,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <StoryLocalization>
        <div className="w-full max-w-3xl p-4">
          <Story />
        </div>
      </StoryLocalization>
    ),
  ],
  args: { hints },
} satisfies Meta<typeof TaskHints>;
export default meta;
type Story = StoryObj<typeof meta>;
export const MixedReferences: Story = {};
export const Empty: Story = { args: { hints: [] } };
export const ReferenceAndCopy: Story = {
  tags: ['contract'],
  play: async ({ canvas, canvasElement, userEvent }) => {
    await canvas.findByText('first/shared');
    await canvas.findByText('second/shared');
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const writeText = fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    try {
      const openers = canvas.getAllByRole('button', { name: 'Full reference' });
      for (const [index, hint] of hints.entries()) {
        openers[index]!.focus();
        await userEvent.keyboard('{Enter}');
        const text = await canvas.findByText(hint.ref, { selector: 'pre', exact: true });
        if (getComputedStyle(text).whiteSpace !== 'pre-wrap')
          throw Error('Full reference must wrap and stay selectable');
        const copy = canvas.getByRole('button', { name: 'Copy reference' });
        await userEvent.click(copy);
        await canvas.findByText('Copied', { exact: true });
        if (writeText.mock.lastCall?.[0] !== hint.ref)
          throw Error('Copy must preserve the exact original reference');
        if (canvasElement.ownerDocument.activeElement !== copy)
          throw Error('Copy must not move focus');
        const hide = canvas.getByRole('button', { name: 'Hide reference' });
        await userEvent.click(hide);
        await waitFor(() => {
          if (canvasElement.ownerDocument.activeElement !== openers[index])
            throw Error('Collapse must restore its opener');
        });
      }
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
      await userEvent.click(openers[0]!);
      await userEvent.click(canvas.getByRole('button', { name: 'Copy reference' }));
      await canvas.findByText('Could not copy. Select and copy the full text manually.');
      await canvas.findByText(hints[0]!.ref, { selector: 'pre', exact: true });
    } finally {
      if (descriptor) Object.defineProperty(navigator, 'clipboard', descriptor);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  },
};
