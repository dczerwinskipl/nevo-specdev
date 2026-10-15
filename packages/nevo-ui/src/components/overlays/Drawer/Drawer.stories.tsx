import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { DesignCaptureProvider } from '@nevo/figma-capture/metadata';
import { Button } from '../../actions/Button';
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from './Drawer';
import { Typography } from '../../foundations/Typography';

function DrawerExample({ canonical = false }: { canonical?: boolean }) {
  const [open, setOpen] = useState(canonical);

  return (
    <div className="min-h-screen bg-canvas p-6 text-content-primary">
      <Typography as="h1" className="mb-2" variant="title-md">
        Repository workspace
      </Typography>
      <Typography as="p" className="m-0 max-w-xl text-content-muted" variant="body-md">
        Open the repository activity drawer without leaving the current workspace.
      </Typography>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button className="mt-5" variant="secondary">
            View activity
          </Button>
        </DrawerTrigger>
        <DrawerContent
          closeLabel="Close customer drawer"
          data-design-canonical={canonical ? 'true' : undefined}
          data-design-source-id={canonical ? 'canonical-open' : undefined}
          onOpenAutoFocus={canonical ? (event) => event.preventDefault() : undefined}
          style={canonical ? { animationDelay: '-220ms' } : undefined}
        >
          <DrawerHeader>
            <DrawerTitle>Repository activity</DrawerTitle>
            <DrawerDescription>
              Recent changes and automation events for the active branch.
            </DrawerDescription>
          </DrawerHeader>

          <DrawerBody>
            <div className="grid gap-3">
              {[
                ['Task 06 started', 'Claude opened the runtime Drawer implementation.'],
                ['Review accepted', 'Dominik approved the capability materialization changes.'],
                ['Branch synchronized', 'The experiment branch is aligned with its remote.'],
              ].map(([title, description]) => (
                <div
                  className="rounded-lg border border-border-default bg-surface px-4 py-3"
                  key={title}
                >
                  <Typography as="h2" className="m-0" variant="label-md">
                    {title}
                  </Typography>
                  <Typography as="p" className="mb-0 mt-1 text-content-muted" variant="body-sm">
                    {description}
                  </Typography>
                </div>
              ))}
            </div>
          </DrawerBody>

          <DrawerFooter>
            <DrawerClose asChild>
              <Button className="w-full sm:w-fit" variant="secondary">
                Close
              </Button>
            </DrawerClose>
            <Button className="w-full sm:w-fit">Open repository</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

const meta = {
  title: 'Nevo UI/Overlays/Drawer',
  component: DrawerExample,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DrawerExample>;

export default meta;
type Story = StoryObj<typeof meta>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function waitFor<T>(read: () => T | null | false, message: string): Promise<T> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = read();
    if (result) return result;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  throw new Error(message);
}

export const Interactive: Story = {};

export const InteractionContract: Story = {
  tags: ['contract', '!autodocs'],
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'View activity' });

    trigger.focus();
    await userEvent.keyboard('{Enter}');

    const dialog = await waitFor(
      () => document.querySelector<HTMLElement>('[role="dialog"]'),
      'Drawer should open as a dialog.',
    );
    assert(dialog.contains(document.activeElement), 'Focus should enter the open Drawer.');

    await userEvent.tab();
    assert(dialog.contains(document.activeElement), 'Tab should remain inside the Drawer.');
    await userEvent.tab({ shift: true });
    assert(dialog.contains(document.activeElement), 'Shift+Tab should remain inside the Drawer.');

    await userEvent.keyboard('{Escape}');
    await waitFor(
      () => document.querySelector('[role="dialog"]') === null,
      'Escape should close the Drawer.',
    );
    await waitFor(
      () => (document.activeElement === trigger ? trigger : null),
      'Escape should restore focus to the trigger.',
    );

    await userEvent.keyboard('{Enter}');
    const closeAction = await waitFor(
      () => document.querySelector<HTMLButtonElement>('button[aria-label="Close customer drawer"]'),
      'The Drawer should expose its named close action.',
    );
    closeAction.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(
      () => document.querySelector('[role="dialog"]') === null,
      'The close action should close the Drawer from the keyboard.',
    );
    await waitFor(
      () => (document.activeElement === trigger ? trigger : null),
      'Closing should restore focus to the trigger.',
    );
  },
};

export const CanonicalCapture: Story = {
  render: () => (
    <DesignCaptureProvider captureComponents={['Drawer', 'IconButton']}>
      <DrawerExample canonical />
    </DesignCaptureProvider>
  ),
  tags: ['capture', '!autodocs'],
  parameters: {
    controls: { disable: true },
    designCapture: {
      component: 'Drawer',
      title: 'Drawer',
      description: 'Static open-state side panel with editable content and reusable actions',
      kind: 'component',
      // Keep the portal-based capture after the existing screen captures so
      // its full-viewport host does not influence their measured coordinates.
      order: 110,
    },
  },
};
