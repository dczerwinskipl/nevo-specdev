import type { Meta, StoryObj } from '@storybook/react-vite';
import { waitFor } from 'storybook/test';
import { StoryLocalization } from '../../../i18n/StoryLocalization';
import { TaskHistoryDetails } from './TaskHistoryDetails';
import { createHistoryDetailsFixture } from './taskHistoryDetails.test-support';

const meta = {
  title: 'SpecFlow/Features/Tasks/Historical details',
  component: TaskHistoryDetails,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <StoryLocalization>
        <div className="w-full max-w-3xl p-4">
          <h3>Historical attempt</h3>
          <Story />
        </div>
      </StoryLocalization>
    ),
  ],
  args: {
    entry: createHistoryDetailsFixture(),
    taskId: 'TASK-03',
    token: 'token',
    revision: 'revision',
  },
} satisfies Meta<typeof TaskHistoryDetails>;
export default meta;
type Story = StoryObj<typeof meta>;
export const MixedAvailability: Story = {};
export const TechnicalReachability: Story = {
  tags: ['contract'],
  play: async ({ canvas, canvasElement, userEvent, args }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Technical data' }));
    await canvas.findByRole('heading', { name: 'Attempt identity' });
    await canvas.findByRole('heading', { name: 'Material relationships' });
    const values = [...canvasElement.querySelectorAll('pre')].map((element) => {
      const value: unknown = JSON.parse(element.textContent);
      return value;
    });
    const entry = args.entry;
    if (
      JSON.stringify(values[0]) !==
      JSON.stringify({
        id: entry.id,
        ...entry.key,
        startedAt: entry.startedAt,
        completedAt: entry.completedAt,
      })
    )
      throw Error('Lost attempt identity or timestamps');
    if (JSON.stringify(values[1]) !== JSON.stringify(entry.provenance))
      throw Error('Lost provenance');
    for (const [index, resource] of entry.resources
      .filter((item) => item.link.state !== 'forbidden')
      .entries()) {
      if (
        JSON.stringify(values[index + 2]) !==
        JSON.stringify({
          id: resource.id,
          title: resource.title,
          origin: resource.origin,
          producedFor: resource.producedFor,
          neededFor: resource.neededFor,
        })
      )
        throw Error('Lost material identity or membership');
    }
    const text = canvasElement.textContent;
    for (const secret of ['secret-material-id', 'Secret material title', 'secret-source'])
      if (text.includes(secret))
        throw Error('Forbidden material leaked through technical disclosure');
    const hide = canvas.getByRole('button', { name: 'Hide technical data' });
    await userEvent.click(hide);
    await waitFor(() => {
      if (canvasElement.ownerDocument.activeElement !== hide)
        throw Error('Technical collapse lost focus');
    });
  },
};
