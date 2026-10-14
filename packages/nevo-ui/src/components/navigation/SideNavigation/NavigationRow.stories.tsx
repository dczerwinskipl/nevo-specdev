import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { DesignCaptureProvider } from '@nevo/figma-capture/metadata';
import { NavigationRow } from './NavigationRow';
const meta = {
  title: 'Nevo UI/Navigation/Navigation Row',
  component: NavigationRow,
  args: {
    label: 'Sessions',
    renderLink: (children, className) => (
      <a href="#sessions" className={className}>
        {children}
      </a>
    ),
  },
} satisfies Meta<typeof NavigationRow>;
export default meta;
type Story = StoryObj<typeof meta>;
function Fixture() {
  const [expanded, setExpanded] = useState(true);
  const [links, setLinks] = useState(0);
  return (
    <div className="w-64">
      <ul className="m-0 p-0">
        <NavigationRow
          label="Sessions"
          icon="chat"
          renderLink={(children, className) => (
            <a
              href="#sessions"
              className={className}
              onClick={(e) => {
                e.preventDefault();
                setLinks((value) => value + 1);
              }}
            >
              {children}
            </a>
          )}
          disclosure={{
            expanded,
            label: expanded ? 'Collapse sessions' : 'Expand sessions',
            onToggle: () => setExpanded((value) => !value),
            content: (
              <a className="block min-h-11" href="#preview">
                Readable Session preview
              </a>
            ),
          }}
        />
      </ul>
      <button className="min-h-11" type="button" onClick={() => setExpanded(false)}>
        External collapse
      </button>
      <output aria-label="List opens">{links}</output>
    </div>
  );
}
export const Playground: Story = {
  render: (args) => (
    <ul className="w-64 p-0">
      <NavigationRow {...args} />
    </ul>
  ),
};
export const DisclosureContract: Story = {
  tags: ['contract', '!autodocs'],
  render: () => <Fixture />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('link', { name: 'Sessions' }));
    if (canvas.getByLabelText('List opens').textContent !== '1')
      throw new Error('The list link must operate independently.');
    const preview = canvas.getByRole('link', { name: 'Readable Session preview' });
    preview.focus();
    canvas.getByRole('button', { name: 'External collapse' }).click();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const trigger = canvas.getByRole('button', { name: 'Expand sessions' });
    if (document.activeElement !== trigger)
      throw new Error('Collapsing focused preview must restore disclosure focus.');
    const panel = document.getElementById(trigger.getAttribute('aria-controls')!);
    if (!panel?.inert || panel.getAttribute('aria-hidden') !== 'true')
      throw new Error('Collapsed preview must immediately stop interaction.');
    await userEvent.click(trigger);
    await userEvent.click(canvas.getByRole('button', { name: 'Collapse sessions' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Expand sessions' }));
    if (canvas.getByLabelText('List opens').textContent !== '1')
      throw new Error('Disclosure must never invoke list navigation.');
  },
};
export const CanonicalCapture: Story = {
  tags: ['capture', '!autodocs'],
  render: () => (
    <DesignCaptureProvider captureComponents={['NavigationRow']}>
      <ul className="grid w-64 list-none gap-4 p-0">
        {(['marker', 'surface'] as const).flatMap((selectionTreatment) =>
          (['none', 'active'] as const).flatMap((state) =>
            (['none', 'collapsed', 'expanded'] as const).map((mode) => (
              <NavigationRow
                key={`${selectionTreatment}-${state}-${mode}`}
                data-design-canonical
                data-design-source-id={`NavigationRow-${selectionTreatment}-${state}-${mode}`}
                selectionTreatment={selectionTreatment}
                active={state === 'active'}
                label="Sessions"
                icon="chat"
                renderLink={(children, className) => (
                  <a className={className} href="#sessions">
                    {children}
                  </a>
                )}
                disclosure={
                  mode === 'none'
                    ? undefined
                    : {
                        expanded: mode === 'expanded',
                        label: 'Show active sessions',
                        onToggle: () => undefined,
                        content: <span>Session preview</span>,
                      }
                }
              />
            )),
          ),
        )}
      </ul>
    </DesignCaptureProvider>
  ),
  parameters: {
    designCapture: {
      component: 'NavigationRow',
      title: 'Navigation row',
      kind: 'component',
      order: 28,
    },
  },
};
