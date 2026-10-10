import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../../actions/Button';
import { Checkbox } from '../../forms/Checkbox';
import { Typography } from '../../foundations/Typography';
import { InformationList } from './InformationList';

const meta = {
  title: 'Nevo UI/Content/InformationList',
  tags: ['contract', '!autodocs'],
  parameters: { controls: { disable: true } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export const InteractionContract: Story = {
  render: () => (
    <div className="w-[36rem] p-4">
      <InformationList selectable>
        <InformationList.Item interactive data-testid="row-1">
          <InformationList.Leading>
            <Checkbox aria-label="Select item 1" />
          </InformationList.Leading>
          <InformationList.Content>
            <Typography variant="title-sm">
              <a
                href="#item-1"
                data-testid="link-1"
                onClick={(e) => {
                  e.preventDefault();
                }}
              >
                Item 1 Title
              </a>
            </Typography>
            <Typography variant="body-sm">Supporting fact</Typography>
          </InformationList.Content>
          <InformationList.Trailing>
            <Button size="sm" variant="secondary" data-testid="action-1">
              Action
            </Button>
          </InformationList.Trailing>
        </InformationList.Item>
      </InformationList>
    </div>
  ),
  play: async ({ canvas, userEvent }) => {
    const checkbox = canvas.getByRole('checkbox', { name: 'Select item 1' });
    const link = canvas.getByTestId('link-1');
    const button = canvas.getByTestId('action-1');

    assert(checkbox, 'Checkbox must be present in selectable row.');
    assert(link, 'Primary title link must be present.');
    assert(button, 'Trailing action button must be present.');

    // Nested controls must remain independently operable
    await userEvent.click(checkbox);
    assert(
      checkbox.getAttribute('data-state') === 'checked',
      'Checkbox should toggle when clicked.',
    );

    await userEvent.click(button);
    // Button is clicked without error
  },
};
