import type { Meta, StoryObj } from '@storybook/react-vite';
import { RoutedApplication } from '../../app/SpecFlowShell.stories';

// The real router and account/navigation shell, not a substitute detail fixture.
const meta = {
  title: 'SpecFlow/Screens/Specification Workspace',
  component: RoutedApplication,
  parameters: { layout: 'fullscreen' },
  args: { path: '/specs/admission?collection=current' },
} satisfies Meta<typeof RoutedApplication>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Working: Story = {
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Specification ID: admission', {}, { timeout: 5000 });
    const checkboxes = await canvas.findAllByRole('checkbox');
    const firstCheckbox = checkboxes[0];
    if (firstCheckbox) {
      await userEvent.click(firstCheckbox);
      await canvas.findByText('1 selected', {}, { timeout: 2000 });
      await userEvent.click(firstCheckbox);
    }
  },
};

export const TaskPreviewFlow: Story = {
  args: { path: '/specs/admission?collection=current' },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Specification ID: admission', {}, { timeout: 10000 });

    const taskElement = await canvas.findByText(
      /Obsługa odświeżania uprawnień w długotrwałej sesji użytkownika/i,
    );
    await userEvent.click(taskElement);

    const taskMatches = await canvas.findAllByText('TASK-03', {}, { timeout: 5000 });
    if (taskMatches.length < 2) throw new Error('Expected TASK-03 in both row and preview');

    const closeBtn = await canvas.findByRole('button', { name: /Close secondary content/i });
    await userEvent.click(closeBtn);

    const historyElements = await canvas.findAllByText(/Activity history/i, {}, { timeout: 5000 });
    if (historyElements.length === 0) throw new Error('Expected Activity history after closing');
  },
};

export const NestedHistoryTaskPreviewFlow: Story = {
  args: { path: '/specs/admission?collection=current' },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Specification ID: admission', {}, { timeout: 10000 });

    // Click task in activity history (TASK-04 event)
    const historyTaskEvent = await canvas.findByRole('button', {
      name: /Rozpoczęto wykonanie TASK-04/i,
    });
    await userEvent.click(historyTaskEvent);

    // Confirm Task Preview opens in secondary
    await canvas.findByRole('heading', { name: /Task preview/i }, { timeout: 5000 });
    const task4Matches = await canvas.findAllByText('TASK-04', {}, { timeout: 5000 });
    if (task4Matches.length < 2) throw new Error('Expected TASK-04 in row and preview');

    // Press Back in secondary stack
    const backBtn = await canvas.findByRole('button', { name: /Back/i });
    await userEvent.click(backBtn);

    // Confirm Activity History is restored
    await canvas.findByText(/This specification/i, {}, { timeout: 5000 });
  },
};

export const FullTaskPromotionFlow: Story = {
  args: { path: '/specs/admission?collection=current' },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Specification ID: admission', {}, { timeout: 10000 });

    const taskElement = await canvas.findByText(
      /Obsługa odświeżania uprawnień w długotrwałej sesji użytkownika/i,
    );
    await userEvent.click(taskElement);

    const fullTaskButtons = await canvas.findAllByText(/Full task view/i);
    const firstButton = fullTaskButtons[0];
    if (!firstButton) {
      throw new Error('Expected Full task view action in task preview');
    }
    await userEvent.click(firstButton);

    await canvas.findByRole('heading', { name: /Task \/ TASK-03/i }, { timeout: 5000 });

    const backBtn = await canvas.findByRole('link', {
      name: /Back to specification|Wróć do specyfikacji/i,
    });
    await userEvent.click(backBtn);

    await canvas.findByText('Specification ID: admission', {}, { timeout: 5000 });
  },
};

export const Current: Story = {
  play: async ({ canvas }) => {
    await canvas.findByText('Specification ID: admission', {}, { timeout: 5000 });
    const back = canvas.getByRole('link', { name: 'Back to Specifications' });
    const icon = back.querySelector('svg')?.getBoundingClientRect();
    const label = back.querySelector('[data-spec-back-label]')?.getBoundingClientRect();
    if (!icon || !label || Math.abs(icon.y + icon.height / 2 - label.y - label.height / 2) > 1)
      throw new Error('Back icon and label must share the same vertical center.');
  },
};

export const Archive: Story = {
  args: { path: '/specs/archive-0?collection=archive' },
  play: async ({ canvas }) => {
    await canvas.findByText('Specification ID: archive-0', {}, { timeout: 5000 });
    canvas.getByRole('link', { name: 'Back to Specifications' });
  },
};

export const EmptyPreparation: Story = {
  args: { path: '/specs/empty-scaffold' },
};

export const PreparingTasks: Story = {
  args: { path: '/specs/preparing-spec' },
};

export const GitConflicts: Story = {
  args: { path: '/specs/conflict-spec' },
};

export const NoGit: Story = {
  args: { path: '/specs/no-git-spec' },
};

export const Documents: Story = {
  args: { path: '/specs/docs-spec/documents' },
};

/**
 * Routed interaction coverage: Full Document promoted from Work returns to Work;
 * direct and list-origin Full Documents fall back to Documents List.
 */
export const DocumentReturnNavigation: Story = {
  args: { path: '/specs/docs-spec?collection=current' },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Specification ID: docs-spec', {}, { timeout: 10000 });
    await userEvent.click(await canvas.findByRole('button', { name: 'Obszar: uwierzytelnianie' }));
    await canvas.findByRole('button', { name: 'Open full document' });
    await userEvent.click(await canvas.findByRole('button', { name: 'Open full document' }));
    await canvas.findByRole('link', { name: /Back to specification/i });
    await userEvent.click(await canvas.findByRole('link', { name: /Back to specification/i }));
    await canvas.findByText('Specification ID: docs-spec', {}, { timeout: 5000 });
  },
};

/** Clicking a document in Primary Documents must return to the owning list. */
export const DocumentBackFromList: Story = {
  args: { path: '/specs/docs-spec/documents?collection=archive' },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByRole('heading', { name: 'Documents', level: 2 });
    const read = await canvas.findAllByRole('button', { name: 'Read' });
    if (!read[0]) throw new Error('Expected an actionable document in the list.');
    await userEvent.click(read[0]);
    const back = await canvas.findByRole('link', { name: 'Back to documents' });
    if (back.getAttribute('href') !== '/specs/docs-spec/documents?collection=archive')
      throw new Error('Document list return must retain Archive context.');
    await userEvent.click(back);
    await canvas.findByRole('heading', { name: 'Documents', level: 2 });
  },
};

/** Direct links have no ephemeral origin and must fall back to the Documents List. */
export const DocumentBackFromDirectLink: Story = {
  args: { path: '/specs/docs-spec/documents/spec?collection=current' },
  play: async ({ canvas, userEvent }) => {
    const back = await canvas.findByRole('link', { name: 'Back to documents' });
    if (back.getAttribute('href') !== '/specs/docs-spec/documents?collection=current')
      throw new Error('Direct document link must have a stable list fallback.');
    await userEvent.click(back);
    await canvas.findByRole('heading', { name: 'Documents', level: 2 });
  },
};

export const RepositoryNavigation: Story = {
  args: { path: '/specs/admission/repository' },
  play: async ({ canvas, userEvent }) => {
    const toChanges = await canvas.findByRole('button', {
      name: /Go to changes|Przejdź do zmian/i,
    });
    await userEvent.click(toChanges);
    await canvas.findByRole('heading', { name: /Changes|Zmiany/i, level: 2 }, { timeout: 5000 });
  },
};

export const LegacyFullTaskLink: Story = {
  args: { path: '/specs/admission?collection=archive&view=task&task=TASK-03' },
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { name: /Task \/ TASK-03/i }, { timeout: 5000 });
  },
};

export const FullTask: Story = {
  args: { path: '/specs/admission/tasks/TASK-03?collection=current' },
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { name: /Task \/ TASK-03/i }, { timeout: 5000 });
    await canvas.findByText('TASK-03 · admission', {}, { timeout: 5000 });
    await canvas.findByText(
      /Obsługa odświeżania uprawnień w długotrwałej sesji użytkownika/i,
      {},
      { timeout: 5000 },
    );
  },
};

export const NarrowLongIdentity: Story = {
  args: { path: `/specs/${'long-identity-'.repeat(16)}` },
  globals: { viewport: { value: 'mobile1', isRotated: false } },
};

export const MobileTaskPreviewFlow: Story = {
  args: { path: '/specs/admission?collection=current' },
  globals: { viewport: { value: 'mobile1', isRotated: false } },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Specification ID: admission', {}, { timeout: 10000 });

    const taskElement = await canvas.findByText(
      /Obsługa odświeżania uprawnień w długotrwałej sesji użytkownika/i,
    );
    await userEvent.click(taskElement);

    // In mobile stacked layout, secondary transitions in and provides Back action
    await canvas.findByRole('heading', { name: /Task preview/i }, { timeout: 5000 });

    const backBtn = await canvas.findByRole('button', { name: /Back/i });
    await userEvent.click(backBtn);

    // After back, primary is restored
    await canvas.findByText('Specification ID: admission', {}, { timeout: 5000 });
  },
};

export const Polish: Story = { args: { locale: 'pl' } };

/**
 * Deliberately bypasses cache seeding. Exercises typed API -> Query ->
 * independent routed Full Task, without requiring a Workspace Task list.
 */
export const ApiDtoToTaskScreen: Story = {
  args: { path: '/specs/api-integration/tasks/TASK-01', integrationDto: true },
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { name: 'Task / TASK-01' }, { timeout: 10000 });
    await canvas.findByRole(
      'heading',
      { name: 'Fresh task detail from Runtime API' },
      { timeout: 10000 },
    );
    await canvas.findByText('Latest acceptance criterion', {}, { timeout: 10000 });
  },
};

export const ApiDtoToDocumentScreen: Story = {
  args: { path: '/specs/api-integration/documents', integrationDto: true },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByRole('heading', { name: 'Documents', level: 2 }, { timeout: 10000 });
    const button = await canvas.findByRole('button', { name: 'Read' }, { timeout: 10000 });
    await userEvent.click(button);
    await canvas.findByRole(
      'heading',
      {
        name: 'Document content from Runtime detail API',
      },
      { timeout: 10000 },
    );
  },
};
