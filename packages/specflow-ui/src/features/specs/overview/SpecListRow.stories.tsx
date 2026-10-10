import { InformationList } from '@nevo/ui';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { StoryLocalization } from '../../../i18n/StoryLocalization';
import { createSpecItem } from '../../../../test-support/specs/overview/fixtures';
import { currentRow } from './presentation';
import { SpecListRow } from './SpecListRow';

function HrefOnlySpecRow() {
  return (
    <StoryLocalization locale="en">
      <InformationList>
        <SpecListRow item={currentRow(createSpecItem())} specificationHref="/specs/admission" />
      </InformationList>
    </StoryLocalization>
  );
}

const meta = {
  title: 'SpecFlow/Features/Specification Row',
  component: HrefOnlySpecRow,
  tags: ['integration'],
} satisfies Meta<typeof HrefOnlySpecRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A standalone href must also enable the overflow Open specification action. */
export const HrefOnlyNavigation: Story = {
  play: async ({ canvas, userEvent }) => {
    const link = canvas.getByRole('link', {
      name: 'Open specification: Deterministic admission and execution boundaries',
    });
    if (link.getAttribute('href') !== '/specs/admission') {
      throw new Error('Specification identity must remain a real link.');
    }
    await userEvent.click(
      canvas.getByRole('button', {
        name: 'Specification actions: Deterministic admission and execution boundaries',
      }),
    );
    const open = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (item) => item.textContent?.trim() === 'Open specification',
    );
    if (!open || open.getAttribute('aria-disabled') === 'true') {
      throw new Error('Standalone href should enable Open specification in overflow.');
    }
    await userEvent.keyboard('{Escape}');
  },
};

function HrefWithCallbackRow() {
  const [opened, setOpened] = useState(false);
  return (
    <StoryLocalization locale="en">
      <InformationList>
        <SpecListRow
          item={currentRow(createSpecItem())}
          specificationHref="/specs/admission"
          onOpenTarget={() => setOpened(true)}
        />
      </InformationList>
      <output aria-label="Navigation result">{opened ? 'opened' : 'idle'}</output>
    </StoryLocalization>
  );
}

export const HrefWithCallback: Story = {
  render: () => <HrefWithCallbackRow />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('link', {
        name: 'Open specification: Deterministic admission and execution boundaries',
      }),
    );
    await canvas.findByText('opened');
  },
};
