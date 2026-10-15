import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';
import type { SessionNavigationSummary } from '../../features/sessions/navigation/summary';
import {
  useSessionDisclosure,
  useSessionDisclosurePreferences,
  type SessionDisclosurePreferences,
} from './useSessionDisclosure';

function Disclosure({
  summary,
  controller,
}: {
  summary: SessionNavigationSummary;
  controller: SessionDisclosurePreferences;
}) {
  const expanded = useSessionDisclosure(
    'example',
    summary,
    controller.preferences,
    controller.setExpanded,
  );
  return (
    <>
      <output aria-label="Expanded">{String(expanded)}</output>
      <button onClick={() => controller.setExpanded('example', !expanded)}>
        Toggle disclosure
      </button>
    </>
  );
}
function DisclosureFixture() {
  const controller = useSessionDisclosurePreferences();
  const [state, setState] = useState<'available' | 'partial' | 'stale'>('partial');
  const [mounted, setMounted] = useState(true);
  return (
    <>
      {mounted ? (
        <Disclosure summary={{ state, attention: true, entries: [] }} controller={controller} />
      ) : null}
      <button onClick={() => setState('stale')}>Stale</button>
      <button onClick={() => setState('available')}>Available</button>
      <button onClick={() => setMounted((value) => !value)}>Toggle navigation mount</button>
    </>
  );
}
const meta = {
  title: 'SpecFlow/Contracts/Session navigation disclosure',
  component: DisclosureFixture,
  tags: ['contract'],
} satisfies Meta<typeof DisclosureFixture>;
export default meta;
type Story = StoryObj<typeof meta>;
export const PreferenceLifetime: Story = {
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByLabelText('Expanded')).toHaveTextContent('false');
    await userEvent.click(canvas.getByRole('button', { name: 'Stale' }));
    await expect(canvas.getByLabelText('Expanded')).toHaveTextContent('false');
    await userEvent.click(canvas.getByRole('button', { name: 'Available' }));
    await waitFor(() => expect(canvas.getByLabelText('Expanded')).toHaveTextContent('true'));
    await userEvent.click(canvas.getByRole('button', { name: 'Toggle disclosure' }));
    for (const name of ['Stale', 'Available', 'Toggle navigation mount', 'Toggle navigation mount'])
      await userEvent.click(canvas.getByRole('button', { name }));
    await expect(canvas.getByLabelText('Expanded')).toHaveTextContent('false');
  },
};
