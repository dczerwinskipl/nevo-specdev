import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../../actions/Button';
import { Checkbox } from '../../forms/Checkbox';
import { Typography } from '../../foundations/Typography';
import { InformationList } from './InformationList';

const meta = {
  title: 'Nevo UI/Content/InformationList',
  component: InformationList,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Structured operational list for high-density scan. Supports symmetric edge insets, optional leading selection, flexible content rail, and optional trailing actions without reserving empty tracks.',
      },
    },
  },
} satisfies Meta<typeof InformationList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="w-[36rem] rounded-surface border border-border-default bg-surface p-4">
      <InformationList>
        <InformationList.Item interactive>
          <InformationList.Content>
            <Typography variant="title-sm" className="text-content-primary">
              Standard Information Row
            </Typography>
            <Typography variant="body-sm" className="text-content-muted">
              Supporting metadata line
            </Typography>
          </InformationList.Content>
        </InformationList.Item>
        <InformationList.Item interactive>
          <InformationList.Content>
            <Typography variant="title-sm" className="text-content-primary">
              Second Row
            </Typography>
            <Typography variant="body-sm" className="text-content-muted">
              Another piece of information
            </Typography>
          </InformationList.Content>
        </InformationList.Item>
      </InformationList>
    </div>
  ),
};

export const SelectableWithActions: Story = {
  render: () => (
    <div className="w-[36rem] rounded-surface border border-border-default bg-surface p-4">
      <InformationList selectable>
        <InformationList.Item interactive selected>
          <InformationList.Leading>
            <Checkbox checked aria-label="Select row 1" />
          </InformationList.Leading>
          <InformationList.Content>
            <Typography variant="title-sm" className="text-content-primary">
              Selected Item with Action
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
        <InformationList.Item interactive>
          <InformationList.Leading>
            <Checkbox checked={false} aria-label="Select row 2" />
          </InformationList.Leading>
          <InformationList.Content>
            <Typography variant="title-sm" className="text-content-primary">
              Unselected Item
            </Typography>
            <Typography variant="body-sm" className="text-content-muted">
              TASK-02 · Pending
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
  ),
};
