import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { DesignCaptureProvider } from '@nevo/figma-capture/metadata';
import { Typography } from '../../foundations/Typography';
import { Progress } from './Progress';

const meta = {
  title: 'Nevo UI/Feedback/Progress',
  component: Progress,
  tags: ['autodocs'],
  args: {
    'aria-label': 'Operation progress',
    value: 67,
  },
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <div className="w-64">
      <Progress {...args} />
    </div>
  ),
};

export const WithMetadata: Story = {
  render: () => (
    <div className="grid w-[28rem] max-w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
      <Typography className="text-content-secondary" variant="body-sm">
        Running
      </Typography>
      <Progress aria-label="Running progress" value={67} />
      <Typography className="text-content-muted" variant="code-md">
        67%
      </Typography>
    </div>
  ),
};

export const Values: Story = {
  render: () => (
    <div className="grid w-[28rem] max-w-full gap-4">
      {[0, 18, 50, 100].map((value) => (
        <div key={value} className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-3">
          <Progress aria-label={`${value}% progress`} value={value} />
          <Typography className="text-right text-content-muted" variant="code-md">
            {value}%
          </Typography>
        </div>
      ))}
    </div>
  ),
};

export const Segmented: Story = {
  render: () => (
    <div className="w-28">
      <Progress
        aria-label="Task completion"
        aria-valuetext="5 of 9 tasks"
        variant="segmented"
        size="compact"
        completed={5}
        total={9}
      />
    </div>
  ),
};

const geometryCases = [
  { width: 112, total: 9, completed: 5, segments: true },
  { width: 104, total: 17, completed: 0, segments: true },
  { width: 104, total: 18, completed: 18, segments: false },
  { width: 112, total: 19, completed: 6, segments: true },
  { width: 112, total: 20, completed: 6, segments: false },
  { width: 688, total: 100, completed: 50, segments: true },
  { width: 51.99, total: 9, completed: 5, segments: false },
  { width: 52, total: 9, completed: 5, segments: true },
  { width: 112, total: 10000, completed: 9999, segments: false },
];

async function waitForGeometry(assert: () => void) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      assert();
      return;
    } catch (error) {
      if (attempt === 59) throw error;
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}
function GeometryFixture() {
  const [index, setIndex] = useState(0);
  const scenario = geometryCases[index]!;
  return (
    <div className="grid gap-4">
      <div style={{ width: scenario.width }}>
        <Progress
          aria-label="Geometry progress"
          variant="segmented"
          size="compact"
          completed={scenario.completed}
          total={scenario.total}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {geometryCases.map((item, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
          >{`Case ${i}: ${item.width}px / ${item.total}`}</button>
        ))}
      </div>
    </div>
  );
}
export const GeometryContract: Story = {
  tags: ['contract', '!autodocs'],
  render: () => <GeometryFixture />,
  play: async ({ canvas, userEvent }) => {
    for (const index of [...geometryCases.keys(), 0]) {
      const scenario = geometryCases[index]!;
      await userEvent.click(
        canvas.getByRole('button', {
          name: `Case ${index}: ${scenario.width}px / ${scenario.total}`,
        }),
      );
      const bar = canvas.getByRole('progressbar');
      await waitForGeometry(() => {
        if (
          bar.getAttribute('data-progress-representation') !==
          (scenario.segments ? 'segmented' : 'continuous')
        )
          throw new Error('Representation must follow actual width.');
        if (
          bar.querySelectorAll('[data-progress-segment]').length !==
          (scenario.segments ? scenario.total : 0)
        )
          throw new Error('Segments must represent exactly the aggregate total.');
      });
      if (
        bar.getAttribute('aria-valuemax') !== String(scenario.total) ||
        bar.getAttribute('aria-valuenow') !== String(scenario.completed)
      )
        throw new Error('Resize must preserve aggregate accessibility.');
      if (
        Math.abs(bar.getBoundingClientRect().width - scenario.width) > 0.02 ||
        bar.getBoundingClientRect().height !== 4
      )
        throw new Error('Fallback must preserve track geometry.');
      const completed = bar.querySelectorAll('[data-completed="true"]');
      if (scenario.segments && completed.length !== scenario.completed)
        throw new Error('Completed segment count is exact.');
      const segment = bar.querySelector<HTMLElement>('[data-progress-segment]');
      if (
        segment &&
        (window.getComputedStyle(segment).borderRadius !== '2px' ||
          segment.getBoundingClientRect().width < 4)
      )
        throw new Error('Segments need rounded, legible ends.');
    }
  },
};

function ProgressCapture() {
  return (
    <DesignCaptureProvider captureComponents={['Progress']}>
      <div className="grid gap-4">
        {(['default', 'compact'] as const).flatMap((size) =>
          (['continuous', 'segmented'] as const).map((variant) => (
            <div key={`${size}-${variant}`} className={size === 'compact' ? 'w-28' : 'w-64'}>
              <Progress
                aria-label="Canonical progress"
                data-design-canonical="true"
                data-design-source-id={
                  size === 'default' && variant === 'continuous' ? 'default' : `${size}-${variant}`
                }
                size={size}
                {...(variant === 'segmented'
                  ? { variant, completed: 5, total: 9 }
                  : { variant, value: 67 })}
              />
            </div>
          )),
        )}
      </div>
    </DesignCaptureProvider>
  );
}

export const CanonicalCapture: Story = {
  render: () => <ProgressCapture />,
  tags: ['capture', '!autodocs'],
  parameters: {
    controls: { disable: true },
    layout: 'fullscreen',
    designCapture: {
      component: 'Progress',
      title: 'Progress',
      description: 'Determinate progress geometry and semantic color roles.',
      kind: 'component',
      order: 114,
    },
  },
};
