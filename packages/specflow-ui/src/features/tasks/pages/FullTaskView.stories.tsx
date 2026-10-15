import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { FullTaskView } from './FullTaskView';
import { StoryLocalization } from '../../../i18n/StoryLocalization';

function StandaloneTask({ href = true }: { href?: boolean }) {
  const [backs, setBacks] = useState(0);
  return (
    <StoryLocalization locale="en">
      <FullTaskView
        task={{ id: 'TASK-03', title: 'Standalone task', status: 'pending' }}
        specKey="UI-1234"
        onBack={() => setBacks((value) => value + 1)}
        backHref={href ? '/specs/example?collection=archive' : undefined}
      >
        <h1>Standalone task</h1>
      </FullTaskView>
      <output aria-label="Back callbacks">{backs}</output>
    </StoryLocalization>
  );
}
const meta = {
  title: 'SpecFlow/Contracts/Standalone full task navigation',
  component: StandaloneTask,
  tags: ['contract'],
} satisfies Meta<typeof StandaloneTask>;
export default meta;
type Story = StoryObj<typeof meta>;
export const HrefAndCallback: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    const back = canvas.getByRole('link', { name: 'Back to specification' });
    await expect(back).toHaveAttribute('href', '/specs/example?collection=archive');
    for (const modifier of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey']) {
      let intercepted: boolean | undefined;
      const doc = canvasElement.ownerDocument;
      const listener = (event: MouseEvent) => {
        intercepted = event.defaultPrevented;
        event.preventDefault();
      };
      doc.addEventListener('click', listener, { once: true });
      back.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, [modifier]: true }),
      );
      await expect(intercepted).toBe(false);
      await expect(canvas.getByLabelText('Back callbacks')).toHaveTextContent('0');
    }
    await userEvent.click(back);
    await expect(canvas.getByLabelText('Back callbacks')).toHaveTextContent('1');
  },
};
export const CallbackOnly: Story = {
  args: { href: false },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Back to specification' }));
    await expect(canvas.getByLabelText('Back callbacks')).toHaveTextContent('1');
  },
};
