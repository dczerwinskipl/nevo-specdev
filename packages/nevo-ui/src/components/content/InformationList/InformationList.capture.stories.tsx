import type { Meta, StoryObj } from '@storybook/react-vite';
import { DesignCaptureProvider } from '@nevo/figma-capture/metadata';
import { Button } from '../../actions/Button';
import { Checkbox } from '../../forms/Checkbox';
import { Typography } from '../../foundations/Typography';
import { InformationList } from './InformationList';

const meta = {
  title: 'Nevo UI/Content/InformationList/Design Capture',
  tags: ['capture', '!autodocs'],
  parameters: { controls: { disable: true }, layout: 'fullscreen' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const InformationListCapture: Story = {
  render: () => (
    <DesignCaptureProvider captureComponents={['InformationList']}>
      <div className="grid w-full max-w-5xl grid-cols-2 gap-10 bg-canvas p-8">
        <div className="rounded-surface border border-border-default bg-surface p-5">
          <InformationList>
            <InformationList.Item interactive>
              <InformationList.Content>
                <Typography variant="title-sm" className="text-content-primary">
                  Non-selectable operational item
                </Typography>
                <Typography variant="body-sm" className="text-content-muted">
                  Compact facts and supporting context
                </Typography>
              </InformationList.Content>
            </InformationList.Item>
          </InformationList>
        </div>
        <div className="rounded-surface border border-border-default bg-surface p-5">
          <InformationList selectable>
            <InformationList.Item interactive selected>
              <InformationList.Leading>
                <Checkbox checked aria-label="Select row" />
              </InformationList.Leading>
              <InformationList.Content>
                <Typography variant="title-sm" className="text-content-primary">
                  Selectable item with action
                </Typography>
                <Typography variant="body-sm" className="text-content-muted">
                  TASK-01 · Active
                </Typography>
              </InformationList.Content>
              <InformationList.Trailing>
                <Button size="sm" variant="secondary">
                  Open
                </Button>
              </InformationList.Trailing>
            </InformationList.Item>
          </InformationList>
        </div>
      </div>
    </DesignCaptureProvider>
  ),
  parameters: {
    designCapture: {
      component: 'InformationList',
      title: 'InformationList',
      description: 'Structured operational list variants for high-density scanning',
      kind: 'component',
      order: 145,
    },
  },
};
