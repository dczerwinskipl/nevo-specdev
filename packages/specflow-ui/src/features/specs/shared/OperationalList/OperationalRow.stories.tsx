import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Checkbox, InformationList, MenuItem, OverflowMenu } from '@nevo/ui';
import { OperationalRow } from './OperationalRow';
import { OperationalGroupHeader } from './OperationalGroupHeader';

function MixedCollection({ narrowPanel = false }: { narrowPanel?: boolean }) {
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  return (
    <main
      className="grid min-w-0 gap-6"
      style={{ width: narrowPanel ? 360 : 'min(100vw - 32px, 1000px)' }}
    >
      {[0, 1, 2].map((group) => (
        <section key={group} className="grid min-w-0 gap-2">
          <OperationalGroupHeader
            label={`Group ${group + 1}`}
            count={10}
            expanded
            onToggle={() => undefined}
          />
          <InformationList selectable>
            {Array.from({ length: 10 }, (_, index) => {
              const id = group * 10 + index;
              return (
                <OperationalRow
                  key={id}
                  primary={
                    index === 0
                      ? 'Short task name'
                      : 'Detailed task title that remains visible at narrow widths. '.repeat(
                          index % 3 === 0 ? 8 : 4,
                        )
                  }
                  onPrimaryClick={() => undefined}
                  compactFacts={[
                    { text: index === 3 ? 'K'.repeat(180) : `TASK-${id}`, mono: true },
                    '12345 / 99999 Tasks',
                  ]}
                  supporting={
                    index === 0
                      ? undefined
                      : {
                          text: 'A reason describing the human action required. '.repeat(
                            index % 3 === 0 ? 14 : 1,
                          ),
                          tone: index % 2 ? 'attention' : 'neutral',
                          icon: 'triangle-alert',
                        }
                  }
                  leading={
                    index % 2 ? (
                      <Checkbox
                        aria-label={`Select task ${id}`}
                        disabled={index === 3}
                        checked={selected.has(id)}
                        onCheckedChange={() =>
                          setSelected((current) => {
                            const next = new Set(current);
                            if (next.has(id)) next.delete(id);
                            else next.add(id);
                            return next;
                          })
                        }
                      />
                    ) : undefined
                  }
                  trailing={
                    <OverflowMenu label={`Task ${id}`} triggerLabel={`Actions for task ${id}`}>
                      <MenuItem onSelect={() => undefined}>Inspect task</MenuItem>
                    </OverflowMenu>
                  }
                  metadata={
                    index % 4 === 0 ? (
                      <span className="max-w-full [overflow-wrap:anywhere]">
                        {'LongTag'.repeat(20)}
                      </span>
                    ) : undefined
                  }
                  selected={selected.has(id)}
                />
              );
            })}
          </InformationList>
        </section>
      ))}
    </main>
  );
}
const meta = {
  title: 'SpecFlow/Components/Operational List',
  tags: ['visual'],
  component: MixedCollection,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof MixedCollection>;
export default meta;
type Story = StoryObj<typeof meta>;
export const MixedLongContent: Story = {};
export const NarrowPanel: Story = { args: { narrowPanel: true } };

const geometryContract: NonNullable<Story['play']> = async ({
  canvasElement,
  canvas,
  userEvent,
}) => {
  const rows = Array.from(canvasElement.querySelectorAll('li')).filter((row) =>
    row.querySelector('[data-spec-title]'),
  );
  for (const row of rows) {
    const title = row.querySelector<HTMLElement>('[data-spec-title]')!;
    const secondary = row.querySelector<HTMLElement>('[data-spec-secondary]')!;
    const metadata = row.querySelector<HTMLElement>('[data-spec-metadata]');
    const r = row.getBoundingClientRect();
    const a = title.getBoundingClientRect();
    const b = secondary.getBoundingClientRect();
    if (a.width < Math.min(160, r.width / 2) || b.width < Math.min(160, r.width / 2))
      throw new Error(
        'Every row must keep usable title and supporting widths even with long metadata',
      );
    if (metadata) {
      const m = metadata.getBoundingClientRect();
      if (m.left < r.left || m.right > r.right + 1)
        throw new Error('Metadata must fit within its row');
      if (m.left < a.right && m.top < b.bottom - 1)
        throw new Error('Metadata must not overlap title or supporting');
    }
    // Selection columns stay aligned even for rows without a checkbox.
    if (
      Math.abs(a.left - rows[0]!.querySelector('[data-spec-title]')!.getBoundingClientRect().left) >
      1
    )
      throw new Error('Selectable collection must preserve its leading axis');
  }
  await userEvent.click(canvas.getByRole('checkbox', { name: 'Select task 1' }));
  if (
    canvas.getByRole('checkbox', { name: 'Select task 1' }).getAttribute('data-state') !== 'checked'
  )
    throw new Error('Selection must remain operable');
  await userEvent.click(canvas.getByRole('button', { name: 'Actions for task 0' }));
  await userEvent.keyboard('{Escape}');
};
export const GeometryDesktop: Story = { tags: ['contract', '!visual'], play: geometryContract };
export const GeometryMobile: Story = {
  ...GeometryDesktop,
  globals: { viewport: { value: 'mobile1', isRotated: false } },
};
export const GeometryNarrowPanel: Story = { ...GeometryDesktop, args: { narrowPanel: true } };
