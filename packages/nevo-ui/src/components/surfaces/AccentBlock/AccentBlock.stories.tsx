import { DesignCaptureProvider } from '@nevo/figma-capture/metadata';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AccentBlock } from './AccentBlock';

const meta = {
  title: 'Nevo UI/Surfaces/AccentBlock',
  component: AccentBlock,
  args: { children: 'A neutral grouping surface for content that needs attention.' },
} satisfies Meta<typeof AccentBlock>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const LongContent: Story = {
  args: { children: 'A long instruction that wraps without hiding information. '.repeat(20) },
};

export const CanonicalCapture: Story = {
  render: () => (
    <DesignCaptureProvider captureComponents={['AccentBlock']}>
      <AccentBlock
        data-design-canonical="true"
        data-design-source-id="default"
        className="w-content-narrow"
      >
        Content requiring attention
      </AccentBlock>
    </DesignCaptureProvider>
  ),
  tags: ['capture', '!autodocs'],
  parameters: {
    controls: { disable: true },
    designCapture: {
      component: 'AccentBlock',
      title: 'AccentBlock',
      description: 'Neutral content grouping with a continuous primary accent on the left.',
      kind: 'component',
      order: 75,
    },
  },
};
