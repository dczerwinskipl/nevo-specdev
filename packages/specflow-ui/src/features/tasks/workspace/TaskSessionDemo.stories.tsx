import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge, ScrollArea, Typography } from '@nevo/ui';
import { useTranslation } from 'react-i18next';
import { StoryLocalization } from '../../../i18n/StoryLocalization';
import { SessionProviderIcon } from '../../sessions/shared/SessionProviderIcon';
import { readDemoSession, type DemoSession } from './taskSessionDemo.stories-support';
import { createWorkspaceFixture } from './taskWorkspace.stories-support';
import { expect } from 'storybook/test';

function DemoScreen({ session }: { readonly session?: DemoSession }) {
  const { t } = useTranslation();
  return (
    <ScrollArea className="h-dvh" aria-label={t('taskWorkspace.sessionDemo.title')}>
      <div
        className="mx-auto grid w-full max-w-content-standard gap-5 p-4 sm:p-6"
        data-session-demo
      >
        <Typography as="p" variant="body-sm" className="text-content-muted">
          {t('taskWorkspace.sessionDemo.notice')}
        </Typography>
        {session ? (
          <>
            <Typography as="h1" variant="title-lg" className="[overflow-wrap:anywhere]">
              {session.title}
            </Typography>
            <div className="flex flex-wrap items-center gap-2">
              <SessionProviderIcon providerId={session.providerId} />
              <span>{session.provider}</span>
              {session.role ? <Badge tone="neutral">{session.role}</Badge> : null}
            </div>
            <div>
              <Badge
                tone={
                  session.status === 'running'
                    ? 'info'
                    : session.status === 'waitingForUser'
                      ? 'attention'
                      : 'neutral'
                }
              >
                {t(`taskWorkspace.sessionStatus.${session.status}`)}
              </Badge>
            </div>
            <Typography as="p" variant="body-md">
              {session.taskId} · {session.step} ·{' '}
              {t('taskWorkspace.attempt', { count: session.attempt })}
            </Typography>
            <Typography as="p" variant="body-md">
              {t(
                session.current
                  ? 'taskWorkspace.currentExecution'
                  : 'taskWorkspace.previousExecution',
              )}
            </Typography>
            {session.status === 'waitingForUser' ? (
              <section className="grid gap-2">
                <Typography as="h2" variant="title-sm">
                  {t('taskWorkspace.sessionDemo.question')}
                </Typography>
                <Typography as="p" variant="body-md">
                  {session.question ?? t('taskWorkspace.sessionDemo.questionUnavailable')}
                </Typography>
              </section>
            ) : null}
            <Typography as="p" variant="body-sm" className="text-content-muted">
              {t('taskWorkspace.sessionDemo.return')}
            </Typography>
          </>
        ) : (
          <Typography as="h1" variant="title-md">
            {t('taskWorkspace.sessionUnavailable')}
          </Typography>
        )}
      </div>
    </ScrollArea>
  );
}
const meta = {
  title: 'SpecFlow/Screens/Task Session Demo',
  component: DemoScreen,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <StoryLocalization locale="pl">
        <Story />
      </StoryLocalization>
    ),
  ],
} satisfies Meta<typeof DemoScreen>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Session: Story = {
  render: () => <DemoScreen session={readDemoSession(window.location.search)} />,
};
export const NeedsResponse: Story = {
  tags: ['contract'],
  args: {
    session: {
      ...createWorkspaceFixture('review').sessions[0]!,
      taskId: 'TASK-03',
      status: 'waitingForUser',
      question: 'Czy błąd występuje także po ponownym logowaniu?',
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Wymaga odpowiedzi', { exact: true })).toBeVisible();
    await expect(canvas.getByText('Czy błąd występuje także po ponownym logowaniu?')).toBeVisible();
    await expect(
      canvas.getByText(/Ten ekran nie jest połączony z rzeczywistą sesją/),
    ).toBeVisible();
    await expect(canvas.queryByRole('textbox')).toBeNull();
  },
};
