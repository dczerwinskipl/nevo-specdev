import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppShell } from '@nevo/ui';
import { within, expect, waitFor } from 'storybook/test';
import { StoryLocalization } from '../../../i18n/StoryLocalization';
import { TaskWorkspace } from './TaskWorkspace';
import { createWorkspaceFixture } from './taskWorkspace.stories-support';
import { useRef, useState } from 'react';
import { TaskWorkspacePreview } from './TaskWorkspacePreview';
import { withSessionDemoLinks } from './taskSessionDemo.stories-support';

const meta = {
  title: 'SpecFlow/Screens/Task Workspace',
  component: TaskWorkspace,
  render: (args) => <TaskWorkspace {...args} data={withSessionDemoLinks(args.data)} />,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story, { parameters }) => (
      <StoryLocalization locale="pl">
        <div
          className="h-dvh max-w-full"
          style={{
            width:
              typeof parameters.workspaceWidth === 'number' ? parameters.workspaceWidth : '100%',
          }}
        >
          <AppShell navigation={<div className="p-4">Specification</div>}>
            <Story />
          </AppShell>
        </div>
      </StoryLocalization>
    ),
  ],
  args: { data: createWorkspaceFixture() },
} satisfies Meta<typeof TaskWorkspace>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Human: Story = {};
function PreviewFixture({ data }: { data: ReturnType<typeof createWorkspaceFixture> }) {
  const [full, setFull] = useState(false);
  const preview = useRef<HTMLDivElement>(null);
  return (
    <>
      <div ref={preview} hidden={full}>
        <TaskWorkspacePreview
          data={withSessionDemoLinks(data)}
          onOpenTask={() => {
            setFull(true);
            requestAnimationFrame(() =>
              preview.current?.ownerDocument
                .querySelector<HTMLElement>('[data-task-workspace="primary"] h1')
                ?.focus({ preventScroll: true }),
            );
          }}
        />
      </div>
      {full ? (
        <TaskWorkspace
          data={withSessionDemoLinks(data)}
          onBack={() => {
            setFull(false);
            requestAnimationFrame(() =>
              preview.current
                ?.querySelector<HTMLButtonElement>('button')
                ?.focus({ preventScroll: true }),
            );
          }}
        />
      ) : null}
    </>
  );
}
export const Preview: Story = { render: (args) => <PreviewFixture {...args} /> };
export const PreviewReturnContract: Story = {
  tags: ['contract'],
  render: (args) => <PreviewFixture {...args} />,
  parameters: { workspaceWidth: 375 },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const opener = canvas.getByRole('button', { name: 'Otwórz Task' });
    await userEvent.click(opener);
    const title = await canvas.findByRole('heading', { level: 1, name: /Zachowaj sesję/ });
    await waitFor(async () => {
      await expect(canvasElement.ownerDocument.activeElement).toBe(title);
    });
    await userEvent.click(canvas.getByRole('button', { name: 'Wstecz' }));
    await waitFor(async () => {
      await expect(canvasElement.ownerDocument.activeElement).toBe(opener);
    });
    await expect(canvas.getByRole('heading', { level: 2, name: /Zachowaj sesję/ })).toBeVisible();
    await expect(canvas.queryByRole('heading', { level: 1, name: /Zachowaj sesję/ })).toBeNull();
  },
};
export const Draft: Story = { args: { data: createWorkspaceFixture('draft') } };
export const Ready: Story = { args: { data: createWorkspaceFixture('ready') } };
export const Implementation: Story = { args: { data: createWorkspaceFixture('implementation') } };
export const ImplementationWaiting: Story = {
  args: { data: createWorkspaceFixture('implementation-waiting') },
};
export const Review: Story = { args: { data: createWorkspaceFixture('review') } };
export const ReviewWaiting: Story = { args: { data: createWorkspaceFixture('review-waiting') } };
export const Completed: Story = { args: { data: createWorkspaceFixture('completed') } };
export const LongContent: Story = { args: { data: createWorkspaceFixture('human', true) } };
export const LongMaterialNames: Story = {
  args: {
    data: (() => {
      const data = createWorkspaceFixture('human', true);
      return {
        ...data,
        handoffs: data.handoffs.map((event, index) =>
          index
            ? event
            : {
                ...event,
                materials: event.materials.map((material, materialIndex) => ({
                  ...material,
                  name: materialIndex === 0 ? `${'VeryLongBasename'.repeat(12)}.md` : material.name,
                  reference:
                    materialIndex === 0
                      ? `docs/history/${'VeryLongBasename'.repeat(12)}.md`
                      : material.reference,
                })),
              },
        ),
      };
    })(),
  },
};
export const UnavailableMaterials: Story = {
  args: {
    data: (() => {
      const data = createWorkspaceFixture();
      return {
        ...data,
        handoffs: data.handoffs.map((event, index) =>
          index
            ? event
            : {
                ...event,
                materials: event.materials.map((material, materialIndex) =>
                  materialIndex === 0
                    ? material
                    : {
                        ...material,
                        content: {
                          state:
                            materialIndex === 1 ? ('unavailable' as const) : ('forbidden' as const),
                        },
                      },
                ),
              },
        ),
      };
    })(),
  },
};
export const NarrowPanel: Story = { parameters: { workspaceWidth: 480 } };
export const SessionProviders: Story = {
  args: {
    data: (() => {
      const data = createWorkspaceFixture();
      return {
        ...data,
        sessions: data.sessions.map((session, index) =>
          index === 1
            ? { ...session, provider: 'Claude', providerId: 'claude' }
            : index === 2
              ? { ...session, provider: 'Inny dostawca', providerId: 'unknown' }
              : session,
        ),
      };
    })(),
  },
};
export const IdleCurrentSession: Story = {
  args: {
    data: {
      ...createWorkspaceFixture('implementation'),
      sessions: createWorkspaceFixture('implementation').sessions.map((session) => ({
        ...session,
        status: 'idle',
      })),
    },
  },
};
export const SessionNeedsResponse: Story = {
  args: {
    data: {
      ...createWorkspaceFixture('review'),
      sessions: createWorkspaceFixture('review').sessions.map((session) => ({
        ...session,
        status: session.current ? 'waitingForUser' : session.status,
        question: session.current ? 'Czy błąd występuje także po ponownym logowaniu?' : undefined,
      })),
    },
  },
};
export const MultipleSessions: Story = {
  args: {
    data: (() => {
      const data = createWorkspaceFixture('review');
      const session = data.sessions[0]!;
      return {
        ...data,
        sessions: [
          session,
          {
            ...session,
            id: 'additional-review',
            title: 'Dodatkowa sesja tej samej próby',
            role: undefined,
          },
          ...data.sessions.slice(1),
        ],
      };
    })(),
  },
};
export const DecisionContract: Story = {
  tags: ['contract'],
  play: async ({ canvas, userEvent }) => {
    await expect(
      canvas.getAllByRole('radio').every((item) => item.getAttribute('aria-checked') === 'false'),
    ).toBe(true);
    await userEvent.click(canvas.getByRole('radio', { name: 'Request changes' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Potwierdź rozstrzygnięcie' }));
    await canvas.findByText('Opisz wymagane zmiany.');
    await userEvent.type(canvas.getByRole('textbox'), 'Zachowaj pozycję scrolla.');
    await userEvent.click(canvas.getByRole('button', { name: 'Potwierdź rozstrzygnięcie' }));
    await canvas.findByText('Demo: sprawdzono rozstrzygnięcie. Stan zadania nie został zmieniony.');
    await expect(canvas.getByRole('textbox')).toHaveValue('Zachowaj pozycję scrolla.');
    const main = canvas.getByRole('heading', { name: /Zachowaj sesję/, level: 1 });
    await expect(within(main.parentElement!).queryByText('Zakończone', { exact: true })).toBeNull();
  },
};
export const ApproveContract: Story = {
  tags: ['contract'],
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('radio', { name: 'Approve' }));
    await canvas.findByText('Zadanie zostanie zakończone.');
    await expect(canvas.getByRole('textbox')).not.toBeRequired();
    await expect(canvas.queryByRole('status')).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: 'Potwierdź rozstrzygnięcie' }));
    await canvas.findByText('Demo: sprawdzono rozstrzygnięcie. Stan zadania nie został zmieniony.');
  },
};
export const MaterialReferencePointerContract: Story = {
  tags: ['contract'],
  args: { data: createWorkspaceFixture('human', true) },
  parameters: { workspaceWidth: 480 },
  play: async ({ canvas, canvasElement, userEvent }) => {
    async function expandReference(scope: HTMLElement, expectedTail: string) {
      const control = within(scope).getByRole('button', { name: 'Pełna referencja' });
      control.scrollIntoView({ block: 'center' });
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      await waitFor(async () => {
        control.scrollIntoView({ block: 'center' });
        const box = control.getBoundingClientRect();
        const target = canvasElement.ownerDocument.elementFromPoint(
          box.left + box.width / 2,
          box.top + box.height / 2,
        );
        await expect(target !== null && control.contains(target), target?.outerHTML).toBe(true);
      });
      await userEvent.click(control);
      await expect(
        within(scope).getByText(new RegExp(`${expectedTail}$`), { selector: 'pre' }),
      ).toBeVisible();
    }
    await expandReference(
      canvasElement.querySelector<HTMLElement>('[data-task-workspace="primary"]')!,
      'review-3.md',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Historia Taska' }));
    await canvas.findByRole('heading', { name: 'Historia Taska' });
    await userEvent.click(
      canvas.getAllByRole('button', { name: 'Materiały tego przekazania' })[1]!,
    );
    await expandReference(
      canvasElement.querySelector<HTMLElement>('[data-task-workspace="history"]')!,
      'review-2.md',
    );
  },
};
export const ReaderReturnContract: Story = {
  tags: ['contract'],
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Czytaj więcej' }));
    await userEvent.click(canvas.getByRole('button', { name: /Instrukcja kroku:/ }));
    await userEvent.click(canvas.getByRole('radio', { name: 'Request changes' }));
    await userEvent.type(canvas.getByRole('textbox'), 'Zachowaj stan czytania.');
    const opener = canvas.getByRole('button', { name: 'review-3.md · Review · próba 3' });
    await userEvent.click(opener);
    await canvas.findByText(/Raport dotyczy/);
    await waitFor(async () => {
      await expect(canvasElement.ownerDocument.activeElement).toBe(
        canvas.getByRole('heading', { level: 2, name: 'review-3.md' }),
      );
    });
    await userEvent.click(canvas.getByRole('button', { name: 'Zamknij panel dodatkowy' }));
    await waitFor(async () => {
      await expect(canvas.getByRole('textbox')).toHaveValue('Zachowaj stan czytania.');
      await expect(canvasElement.ownerDocument.activeElement).toBe(
        canvas.getByRole('button', { name: 'review-3.md · Review · próba 3' }),
      );
    });
    await expect(canvas.getAllByRole('button', { name: 'Czytaj mniej' })[0]).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(canvas.getByRole('button', { name: /Instrukcja kroku:/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  },
};
export const NarrowHistoryCloseContract: Story = {
  tags: ['contract'],
  parameters: { workspaceWidth: 480 },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Historia Taska' }));
    await canvas.findByRole('heading', { name: 'Historia Taska' });
    await userEvent.click(
      canvas.getAllByRole('button', { name: 'Materiały tego przekazania' })[1]!,
    );
    const opener = await canvas.findByRole('button', { name: 'review-2.md · Review · próba 2' });
    const scrollOwner = () => {
      for (let element = opener.parentElement; element; element = element.parentElement) {
        if (
          /(auto|scroll)/.test(getComputedStyle(element).overflowY) &&
          element.scrollHeight > element.clientHeight + 1
        )
          return element;
      }
      throw new Error('History must have a scroll owner');
    };
    const before = Math.min(30, scrollOwner().scrollHeight - scrollOwner().clientHeight);
    scrollOwner().scrollTop = before;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    await userEvent.click(opener);
    await canvas.findByText(/Raport dotyczy/);
    await userEvent.click(canvas.getByRole('button', { name: 'Zamknij panel dodatkowy' }));
    await waitFor(async () => {
      await expect(canvasElement.ownerDocument.activeElement).toBe(
        canvas.getByRole('button', { name: 'review-2.md · Review · próba 2' }),
      );
      const returned = canvas.getByRole('button', { name: 'review-2.md · Review · próba 2' });
      let owner = returned.parentElement;
      while (
        owner &&
        !(
          /(auto|scroll)/.test(getComputedStyle(owner).overflowY) &&
          owner.scrollHeight > owner.clientHeight + 1
        )
      )
        owner = owner.parentElement;
      await expect(owner?.scrollTop).toBe(before);
    });
    await expect(canvas.getByRole('button', { name: 'Ukryj materiały' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Zamknij panel dodatkowy' }));
    await canvas.findByRole('heading', { level: 1, name: /Zachowaj sesję/ });
  },
};
