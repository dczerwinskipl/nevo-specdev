import type { Meta, StoryObj } from '@storybook/react-vite';
import { SecondaryStackExample } from './SecondaryStackExample';

const meta = {
  title: 'Nevo UI/Workspace/Secondary stack navigation',
  component: SecondaryStackExample,
  parameters: { layout: 'fullscreen' },
  tags: ['contract'],
} satisfies Meta<typeof SecondaryStackExample>;
export default meta;
type Story = StoryObj<typeof meta>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function currentSecondary(root: HTMLElement) {
  return root.querySelector<HTMLElement>(
    '[data-workspace-surface="secondary"][data-workspace-active="true"]',
  );
}

export const ClosePageReturnsToParent: Story = {
  args: { width: 1400, closeBehavior: 'page' },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Review navigation' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Todo history' }));
    const opener = canvas.getByRole('button', { name: 'Open e1' });
    await userEvent.click(opener);
    await userEvent.click(canvas.getByRole('button', { name: 'Close secondary content' }));
    assert(
      currentSecondary(canvasElement)?.textContent?.includes('Todo history'),
      'Page Close must return to the parent page',
    );
    for (
      let frame = 0;
      frame < 40 && canvasElement.ownerDocument.activeElement?.textContent !== 'Open e1';
      frame++
    ) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    assert(
      canvasElement.ownerDocument.activeElement?.textContent === 'Open e1',
      'Page Close must restore the opener focus',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Close secondary content' }));
    assert(
      currentSecondary(canvasElement)?.textContent?.includes('Review navigation'),
      'Page Close must preserve the root until it is closed',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Close secondary content' }));
    assert(
      canvas.getByText(/Default Secondary/),
      'Closing the root must restore declarative Secondary',
    );
  },
};

export const DesktopDeepNavigationAndRefresh: Story = {
  args: { width: 1400 },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Review navigation' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Todo history' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Open e1' }));
    let secondary = currentSecondary(canvasElement);
    assert(secondary, 'The event inspector should be active');
    const instance = secondary
      .querySelector('[data-screen-mount]')
      ?.getAttribute('data-screen-mount');
    const before = secondary.querySelector('[data-updated-at]')?.textContent;
    await userEvent.click(canvas.getByRole('button', { name: 'Refresh data' }));
    secondary = currentSecondary(canvasElement);
    assert(secondary, 'The same inspector should stay active after refetch');
    assert(
      secondary.querySelector('[data-updated-at]')?.textContent !== before,
      'The active inspector must receive new data',
    );
    assert(
      secondary.querySelector('[data-screen-mount]')?.getAttribute('data-screen-mount') ===
        instance,
      'Refetch must not remount the active inspector',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Remove Event e1' }));
    assert(
      secondary.textContent?.includes('This history entry is no longer available.'),
      'Missing nested item must be reported',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Remove Todo t1' }));
    assert(
      secondary.textContent?.includes('Todo no longer available.'),
      'A missing root entity must not close Secondary',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Anna' }));
    secondary = currentSecondary(canvasElement);
    assert(
      secondary?.textContent?.includes('Anna'),
      'Opening User must replace the entire Todo flow',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Close secondary content' }));
    assert(canvas.getByText(/Default Secondary/), 'Closing must return to declarative Secondary');
  },
};

export const NarrowBackAndMissingEntity: Story = {
  args: { width: 390 },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Review navigation' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Todo history' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Open e1' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Back' }));
    let secondary = currentSecondary(canvasElement);
    assert(
      secondary?.textContent?.includes('Todo history'),
      'Mobile Back should pop the event page',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Back' }));
    secondary = currentSecondary(canvasElement);
    assert(secondary?.textContent?.includes('Review navigation'), 'Mobile Back should pop to root');
    await userEvent.click(canvas.getByRole('button', { name: 'Back' }));
    assert(
      canvas.getByRole('button', { name: 'Open navigation' }),
      'Primary should regain its hamburger when the flow closes',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Remove Todo t1' }));
    assert(
      canvas.queryByRole('button', { name: 'Review navigation' }) === null,
      'The removed todo should disappear from Primary',
    );
  },
};
