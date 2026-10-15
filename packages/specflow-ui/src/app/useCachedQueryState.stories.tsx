import { useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';
import { useCachedQueryState } from './useCachedQueryState';

function Snapshot({ entry }: { entry: string }) {
  const snapshot = useCachedQueryState<string>(['cache-observer', entry]);
  const renders = useRef(0);
  renders.current++;
  return (
    <output aria-label="Cache snapshot" data-renders={renders.current}>
      {snapshot?.data ?? 'missing'}
    </output>
  );
}
function CacheObserverFixture() {
  const client = useMemo(() => new QueryClient(), []);
  const [entry, setEntry] = useState('first');
  const [mounted, setMounted] = useState(true);
  const [listeners, setListeners] = useState<boolean>();
  return (
    <QueryClientProvider client={client}>
      {mounted ? <Snapshot entry={entry} /> : null}
      <button onClick={() => client.setQueryData(['cache-observer', 'first'], 'updated')}>
        Update
      </button>
      <button onClick={() => client.removeQueries({ queryKey: ['cache-observer', 'first'] })}>
        Remove
      </button>
      <button onClick={() => client.setQueryData(['cache-observer', 'first'], 'recreated')}>
        Recreate
      </button>
      <button
        onClick={() => {
          client.setQueryData(['cache-observer', 'second'], 'second value');
          setEntry('second');
        }}
      >
        Change key
      </button>
      <button onClick={() => client.setQueryData(['cache-observer', 'first'], 'unrelated')}>
        Update old key
      </button>
      <button onClick={() => setMounted(false)}>Unmount</button>
      <button onClick={() => setListeners(client.getQueryCache().hasListeners())}>
        Inspect subscription
      </button>
      <output aria-label="Cache subscriptions">{String(listeners)}</output>
    </QueryClientProvider>
  );
}
const meta = {
  title: 'SpecFlow/Contracts/Cache observer',
  component: CacheObserverFixture,
  tags: ['contract'],
} satisfies Meta<typeof CacheObserverFixture>;
export default meta;
type Story = StoryObj<typeof meta>;
export const CacheOnlyLifecycle: Story = {
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByLabelText('Cache snapshot')).toHaveTextContent('missing');
    for (const [action, value] of [
      ['Update', 'updated'],
      ['Remove', 'missing'],
      ['Recreate', 'recreated'],
      ['Change key', 'second value'],
    ] as const) {
      await userEvent.click(canvas.getByRole('button', { name: action }));
      await waitFor(() => expect(canvas.getByLabelText('Cache snapshot')).toHaveTextContent(value));
    }
    const count = canvas.getByLabelText('Cache snapshot').getAttribute('data-renders');
    await userEvent.click(canvas.getByRole('button', { name: 'Update old key' }));
    await expect(canvas.getByLabelText('Cache snapshot')).toHaveAttribute('data-renders', count);
    await userEvent.click(canvas.getByRole('button', { name: 'Unmount' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Inspect subscription' }));
    await expect(canvas.getByLabelText('Cache subscriptions')).toHaveTextContent('false');
  },
};
