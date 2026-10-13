import { within, waitFor } from 'storybook/test';
import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppShell } from '@nevo/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { TestServicesRouterContext } from '../../../../test-support/app/TestServicesRouterContext';
import { StoryLocalization } from '../../../i18n/StoryLocalization';
import { createSpecFlowAppServices } from '../../../services';
import { createSpecFlowQueryClient } from '../../../app/queryClient';
import { builtInUiModuleRegistry } from '../../../app/ui-modules/builtInUiModules';
import { UiModulesProvider } from '../../../app/ui-modules/UiModulesProvider';
import { SpecificationWorkspace } from '../../specs/workspace/SpecificationWorkspace';
import { createSpecificationWorkspaceFixture } from '../../../../test-support/specs/workspace/fixtures';
import { createTaskDetailFixture, type TaskScenario } from '../detail/taskDetail.test-support';
import { taskKeys } from '../queries';
import { mapFullTaskResponse } from '../model';
import { SpecificationTaskPage } from './SpecificationTaskPage';
import { useSpecificationTask } from '../useSpecificationTask';
import { HttpClientError } from '@nevo/http-client';

export function TaskWorkbenchFixture({
  scenario = 'human-gates',
  stress = false,
  preview = false,
  narrowPanel = false,
  pageState = 'ready',
  emptyHistoryHints = false,
  mixedReferences = false,
}: {
  scenario?: TaskScenario;
  stress?: boolean;
  preview?: boolean;
  narrowPanel?: boolean;
  pageState?: 'ready' | 'loading' | 'error' | 'expired';
  emptyHistoryHints?: boolean;
  mixedReferences?: boolean;
}) {
  const [promoted, setPromoted] = useState(false);
  const setup = useMemo(() => {
    const fixture = createTaskDetailFixture(scenario, stress);
    if (mixedReferences) {
      fixture.resources[1]!.title = 'Session without a reader';
      fixture.resources[1]!.kind = 'session';
      fixture.resources[1]!.link = {
        state: 'available',
        target: { kind: 'session', sessionId: 'session-1' },
      };
      fixture.resources[2]!.title = 'Missing material';
      fixture.resources[2]!.link = { state: 'unavailable', reason: 'not_found' };
      const human = fixture.response.snapshot!.sections.humanRequirements;
      if (human.state === 'available')
        human.data.items[0]!.evidence.push(
          { title: 'Session evidence without a reader', link: fixture.resources[1]!.link },
          { title: 'Missing evidence', link: fixture.resources[2]!.link },
        );
    }
    const query = createSpecFlowQueryClient();
    query.setQueryDefaults(taskKeys.detail('admission', 'TASK-03'), { staleTime: Infinity });
    query.setQueryData(taskKeys.detail('admission', 'TASK-03'), fixture.response);
    let expired = false;
    const fresh = structuredClone(fixture.response);
    if (fresh.snapshot) {
      fresh.snapshot.revision = 'fixture-2';
      const source = fresh.snapshot.sections.resources;
      if (source.state === 'available' && source.data.page) source.data.page.token = 'fixture-2';
    }
    const services = createSpecFlowAppServices({
      taskApi: {
        getTask: () => Promise.resolve(expired ? fresh : fixture.response),
        getResources: () => {
          if (pageState === 'expired' && !expired) {
            expired = true;
            return Promise.reject(
              new HttpClientError('Snapshot expired', {
                kind: 'http',
                status: 409,
                data: { error: 'task_snapshot_expired' },
              }),
            );
          }
          return pageState === 'error'
            ? Promise.reject(new Error('Page unavailable'))
            : Promise.resolve({
                token: expired ? 'fixture-2' : 'fixture-1',
                items: fixture.resources.slice(3),
                nextCursor: null,
                coverage: 'complete',
              });
        },
        getHistory: (_specId, _taskId, _token, cursor) =>
          pageState === 'loading'
            ? new Promise(() => undefined)
            : pageState === 'error'
              ? Promise.reject(new Error('Page unavailable'))
              : Promise.resolve({
                  token: 'fixture-1',
                  items: [
                    {
                      id: cursor ? 'build-2' : 'build-1',
                      key: { ...fixture.key, stepId: 'build', attempt: cursor ? 2 : 1 },
                      step: {
                        ...fixture.step,
                        id: 'build',
                        executor: 'agent',
                        hints: emptyHistoryHints
                          ? []
                          : [
                              {
                                kind: 'file',
                                ref: stress
                                  ? `${'historical/very-long-path/'.repeat(12)}session-before.ts`
                                  : 'historical/session-before.ts',
                              },
                            ],
                        purpose:
                          'Implement the original session behaviour before manual verification.',
                        expectedWork: { summary: 'Original session implementation' },
                      },
                      startedAt: '2026-10-10T10:00:00Z',
                      completedAt: '2026-10-10T11:00:00Z',
                      result: 'pass',
                      transitionedTo: { kind: 'step', step: fixture.step },
                      feedback: 'Historical return test completed.',
                      resources: [
                        {
                          id: 'historical-document',
                          kind: 'document',
                          relation: 'output',
                          producedFor: [
                            { ...fixture.key, stepId: 'build', attempt: cursor ? 2 : 1 },
                          ],
                          neededFor: [],
                          origin: { kind: 'completion', sourceId: cursor ? 'build-2' : 'build-1' },
                          title: 'Historical verification record',
                          link: {
                            state: 'available',
                            target: {
                              kind: 'document',
                              specId: 'admission',
                              documentId: 'history-guide',
                              revision: 'fixture-1',
                            },
                          },
                        },
                      ],
                      provenance: [
                        { source: 'workflow_history', sourceId: cursor ? 'build-2' : 'build-1' },
                      ],
                    },
                  ],
                  nextCursor: cursor ? null : 'page-2',
                  coverage: 'complete',
                }),
      },
      documentApi: {
        getDocument: (_specId, documentId) =>
          Promise.resolve({
            id: documentId,
            title: fixture.response.task.title,
            content:
              documentId === 'history-guide'
                ? '# Historical verification record\n\nMaterial from the selected completed attempt.'
                : fixture.document,
            revision: 'fixture-1',
          }),
      },
    });
    const workspace = createSpecificationWorkspaceFixture('working', 'admission');
    return {
      fixture,
      query,
      services,
      workspace: {
        ...workspace,
        taskGroups: [
          {
            id: 'tasks',
            name: 'Tasks',
            tasks: [{ ...mapFullTaskResponse(fixture.response), group: 'tasks' }],
          },
        ],
      },
    };
  }, [scenario, stress, pageState, emptyHistoryHints, mixedReferences]);
  return (
    <StoryLocalization>
      <QueryClientProvider client={setup.query}>
        <TestServicesRouterContext services={setup.services}>
          <UiModulesProvider modules={builtInUiModuleRegistry}>
            <div style={{ width: narrowPanel ? 480 : '100%', height: '100dvh', maxWidth: '100%' }}>
              <AppShell navigation={<div className="p-4">Navigation</div>}>
                {preview && !promoted ? (
                  <SpecificationWorkspace
                    specId="admission"
                    data={setup.workspace}
                    onOpenTask={() => setPromoted(true)}
                  />
                ) : (
                  <ConnectedTaskFixture />
                )}
              </AppShell>
            </div>
          </UiModulesProvider>
        </TestServicesRouterContext>
      </QueryClientProvider>
    </StoryLocalization>
  );
}
function ConnectedTaskFixture() {
  const taskState = useSpecificationTask('admission', 'TASK-03');
  return (
    <SpecificationTaskPage
      specId="admission"
      taskId="TASK-03"
      collection="current"
      taskState={taskState}
      onBack={() => undefined}
    />
  );
}
const meta = {
  title: 'SpecFlow/Screens/Task Workbench',
  tags: ['visual'],
  component: TaskWorkbenchFixture,
  parameters: { layout: 'fullscreen' },
  args: { scenario: 'human-gates', stress: false, preview: false, narrowPanel: false },
} satisfies Meta<typeof TaskWorkbenchFixture>;
export default meta;
type Story = StoryObj<typeof meta>;
export const HumanWithGates: Story = {};
export const RichHuman: Story = { args: { scenario: 'rich-human' } };
export const RichLongContent: Story = { args: { scenario: 'rich-human', stress: true } };
function assertWrappedHint(reference: HTMLElement) {
  if ((reference.closest('li')?.clientWidth ?? 0) < 640)
    throw new Error(
      'This regression must exercise a row at or above the 40rem truncation threshold',
    );
  const style = getComputedStyle(reference);
  const bounds = reference.getBoundingClientRect();
  const range = reference.ownerDocument.createRange();
  range.selectNodeContents(reference);
  const lines = [...range.getClientRects()];
  if (
    style.whiteSpace === 'nowrap' ||
    lines.length < 2 ||
    lines.some((line) => line.right > bounds.right + 1 || line.bottom > bounds.bottom + 1)
  )
    throw new Error('Every line, including the reference suffix, must fit the wrapping primary');
}
const hintsContract: NonNullable<Story['play']> = async ({
  canvas,
  canvasElement,
  userEvent,
  args,
}) => {
  if (args.preview)
    await userEvent.click(await canvas.findByRole('button', { name: /Preserve .*session/ }));
  if (args.emptyHistoryHints) {
    if (!canvasElement.querySelector('[data-layout="split"]')) {
      await userEvent.click(await canvas.findByRole('button', { name: 'More actions' }));
      await userEvent.click(
        await within(canvasElement.ownerDocument.body).findByRole('menuitem', {
          name: 'Task history',
        }),
      );
    }
    await userEvent.click(await canvas.findByRole('button', { name: 'Attempt details' }));
    await canvas.findByRole('heading', { name: 'Original session implementation' });
  } else {
    await userEvent.click(
      await canvas.findByRole('button', {
        name:
          args.scenario === 'not-started'
            ? 'Next step details'
            : args.scenario === 'agent'
              ? 'Step details'
              : 'Details',
      }),
    );
    await canvas.findByRole('heading', { name: 'Declared work transitions' });
  }
  if (!args.stress) {
    if (canvas.queryByRole('heading', { name: 'Hints' }))
      throw new Error('Known empty hints must omit the entire region');
    return;
  }
  if (canvas.queryByText(`${'src/very-long-path/'.repeat(12)}session.ts`))
    throw Error('Raw reference must be collapsed on the first scan');
  await userEvent.click(canvas.getAllByRole('button', { name: 'Full reference' })[2]!);
  const reference = await canvas.findByText(`${'src/very-long-path/'.repeat(12)}session.ts`, {
    exact: true,
  });
  await waitFor(() => assertWrappedHint(reference));
};
export const HintsLongFull: Story = {
  args: { scenario: 'rich-human', stress: true },
  tags: ['contract', '!visual'],
  parameters: {
    viewport: {
      options: { hintsTablet: { name: 'Hints 768', styles: { width: '768px', height: '1000px' } } },
    },
  },
  globals: { viewport: { value: 'hintsTablet', isRotated: false } },
  play: hintsContract,
};
export const HintsLongPreview: Story = {
  ...HintsLongFull,
  args: { ...HintsLongFull.args, preview: true },
};
export const HintsLongHistory: Story = {
  ...HintsLongFull,
  play: async ({ canvas, canvasElement, userEvent }) => {
    if (!canvasElement.querySelector('[data-layout="split"]')) {
      await userEvent.click(await canvas.findByRole('button', { name: 'More actions' }));
      await userEvent.click(
        await within(canvasElement.ownerDocument.body).findByRole('menuitem', {
          name: 'Task history',
        }),
      );
    }
    await userEvent.click(await canvas.findByRole('button', { name: 'Attempt details' }));
    await userEvent.click(await canvas.findByRole('button', { name: 'Full reference' }));
    const reference = await canvas.findByText(
      `${'historical/very-long-path/'.repeat(12)}session-before.ts`,
      { exact: true },
    );
    await waitFor(() => assertWrappedHint(reference));
  },
};
export const HintsEmptyCurrent: Story = {
  args: { scenario: 'agent' },
  tags: ['contract', '!visual'],
  play: hintsContract,
};
export const HintsEmptyNext: Story = {
  args: { scenario: 'not-started' },
  tags: ['contract', '!visual'],
  play: hintsContract,
};
export const HintsEmptyHistory: Story = {
  args: { emptyHistoryHints: true },
  tags: ['contract', '!visual'],
  play: hintsContract,
};
export const RichPreview: Story = { args: { scenario: 'rich-human', preview: true } };
export const NextHuman: Story = { args: { scenario: 'next-human' } };
export const NoNext: Story = { args: { scenario: 'no-next' } };
export const IndependentRequirements: Story = { args: { scenario: 'work-unavailable' } };
export const HumanForbidden: Story = { args: { scenario: 'human-forbidden' } };
export const MismatchedRequirement: Story = { args: { scenario: 'mismatch' } };
export const Preview: Story = { args: { preview: true } };
export const HistoryLoading: Story = { args: { pageState: 'loading' } };
export const PageError: Story = { args: { pageState: 'error' } };
export const NotStarted: Story = { args: { scenario: 'not-started' } };
export const NoDescription: Story = { args: { scenario: 'no-description' } };
export const Recovery: Story = { args: { scenario: 'recovery' } };
export const Agent: Story = { args: { scenario: 'agent' } };
export const HumanWithoutSession: Story = { args: { scenario: 'human-only' } };
export const Gates: Story = { args: { scenario: 'gates' } };
export const Checkpoint: Story = { args: { scenario: 'checkpoint' } };
export const Retry: Story = { args: { scenario: 'retry' } };
export const Terminal: Story = { args: { scenario: 'terminal' } };
export const Unavailable: Story = { args: { scenario: 'unavailable' } };
export const Forbidden: Story = { args: { scenario: 'forbidden' } };
export const UnknownResource: Story = { args: { scenario: 'unknown-resource' } };
export const LongContent: Story = { args: { stress: true } };
export const NarrowPanel: Story = { args: { narrowPanel: true } };
export const DisclosureContract: Story = {
  tags: ['contract'],
  play: async ({ canvas, userEvent }) => {
    await canvas.findByRole('heading', { name: 'Preserve session and navigation context' });
    const showRequirements = await canvas.findByRole('button', { name: 'Show all (21)' });
    await userEvent.click(showRequirements);
    await canvas.findByRole('button', { name: 'Independent verification 20' });
    const controls = await canvas.findAllByRole('button', { name: 'Show less' });
    await userEvent.click(controls[0]!);
    const resources = await canvas.findByRole('button', { name: 'Show all (14)' });
    await userEvent.click(resources);
    await canvas.findByRole('button', { name: 'Verification material 14' });
  },
};

export const SnapshotExpired: Story = {
  args: { pageState: 'expired' },
  tags: ['contract'],
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Show all (14)' }));
    await userEvent.click(await canvas.findByRole('button', { name: 'Retry' }));
    await canvas.findByRole('button', { name: 'Verification material 14' });
  },
};

const previewScrollContract: NonNullable<Story['play']> = async ({
  canvas,
  canvasElement,
  userEvent,
}) => {
  await userEvent.click(
    await canvas.findByRole('button', {
      name: /Preserve user context across a long running session/,
    }),
  );
  const preview = canvasElement.querySelector<HTMLElement>('[data-task-details="preview"]');
  if (!preview) throw new Error('Expected Task preview');
  const content = within(preview);
  await userEvent.click(await content.findByRole('button', { name: 'Show more' }));
  await content.findByRole('heading', { name: 'Section 100' });
  const resource = await content.findByRole('button', {
    name: 'Verification material 2',
  });
  resource.focus();
  let owner = resource.parentElement;
  while (
    owner &&
    !(
      /auto|scroll/.test(getComputedStyle(owner).overflowY) &&
      owner.scrollHeight > owner.clientHeight + 1
    )
  )
    owner = owner.parentElement;
  if (!owner) throw new Error('Expected a scrolling viewport');
  owner.scrollTop = Math.max(0, owner.scrollTop - 100);
  const savedTop = owner.scrollTop;
  await userEvent.click(resource);
  await userEvent.click(await canvas.findByRole('button', { name: 'Back' }));
  const restored = await canvas.findByRole('button', {
    name: 'Verification material 2',
  });
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  let restoredOwner = restored.parentElement;
  while (
    restoredOwner &&
    !(
      /auto|scroll/.test(getComputedStyle(restoredOwner).overflowY) &&
      restoredOwner.scrollHeight > restoredOwner.clientHeight + 1
    )
  )
    restoredOwner = restoredOwner.parentElement;
  if (!restoredOwner || Math.abs(restoredOwner.scrollTop - savedTop) > 2)
    throw new Error(
      `Back must restore the exact viewport position: ${savedTop} -> ${restoredOwner?.scrollTop}`,
    );
  if (canvasElement.ownerDocument.activeElement !== restored)
    throw new Error('Back must restore resource focus');
  const returned = canvasElement.querySelector<HTMLElement>('[data-task-details="preview"]');
  if (!returned) throw new Error('Expected preview after Back');
  const less = within(returned).getAllByRole('button', { name: 'Show less' });
  await userEvent.click(less.at(-1)!);
  const opener = await within(returned).findByRole('button', { name: 'Show more' });
  if (canvasElement.ownerDocument.activeElement !== opener)
    throw new Error('Collapse must restore the description opener');
};
export const PreviewScrollDesktop: Story = {
  args: { preview: true, stress: true },
  tags: ['contract'],
  play: previewScrollContract,
};
export const PreviewScrollNarrow: Story = {
  ...PreviewScrollDesktop,
  globals: { viewport: { value: 'mobile1', isRotated: false } },
};

const evidenceContract: NonNullable<Story['play']> = async ({
  canvas,
  canvasElement,
  userEvent,
  args,
}) => {
  if (args.preview)
    await userEvent.click(
      await canvas.findByRole('button', {
        name: 'Preserve session and navigation context',
      }),
    );
  await userEvent.click(await canvas.findByRole('button', { name: 'Verify session behaviour' }));
  const evidence = await canvas.findByRole('button', { name: 'Verification instructions' });
  // Let the workspace's entering-screen focus settle before exercising keyboard activation.
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  evidence.focus();
  await userEvent.keyboard('{Enter}');
  await canvas.findByRole('heading', { name: 'Acceptance criteria' });
  await userEvent.click(await canvas.findByRole('button', { name: 'Back' }));
  await waitFor(() => {
    const restored = canvas.getByRole('button', { name: 'Verification instructions' });
    if (canvasElement.ownerDocument.activeElement !== restored)
      throw new Error('Back must restore evidence focus in its requirement');
  });
  await canvas.findByRole('heading', { name: 'Declared work transitions' });
  await canvas.findByRole('heading', { name: 'Requirement decisions' });
};
export const EvidenceFull: Story = { tags: ['contract'], play: evidenceContract };
export const EvidencePreview: Story = {
  args: { preview: true },
  tags: ['contract'],
  play: evidenceContract,
};
export const EvidenceNarrow: Story = {
  ...EvidencePreview,
  globals: { viewport: { value: 'mobile1', isRotated: false } },
};

const flowContract: NonNullable<Story['play']> = async ({
  canvas,
  canvasElement,
  userEvent,
  args,
}) => {
  if (args.preview)
    await userEvent.click(
      await canvas.findByRole('button', {
        name: 'Preserve session and navigation context',
      }),
    );
  await userEvent.click(await canvas.findByRole('button', { name: 'Work actions' }));
  await userEvent.click(
    await within(canvasElement.ownerDocument.body).findByRole('menuitem', { name: 'Flow details' }),
  );
  await canvas.findByRole('heading', { name: 'Implement session behaviour' });
  await canvas.findByRole('heading', { name: 'Verify session behaviour' });
  await canvas.findByText('To: verify');
  await canvas.findByText('To: build · Feedback required');
  await canvas.findByText('To: done · Completed successfully');
  await canvas.findByText(/verify · Human · Current position · Attempt 1/);
};
export const FlowFull: Story = { tags: ['contract'], play: flowContract };
export const FlowPreview: Story = {
  args: { preview: true },
  tags: ['contract'],
  play: flowContract,
};
export const FlowNarrow: Story = {
  ...FlowPreview,
  globals: { viewport: { value: 'mobile1', isRotated: false } },
};

export const EvidenceFullNarrow: Story = {
  ...EvidenceFull,
  globals: { viewport: { value: 'mobile1', isRotated: false } },
};
export const FlowFullNarrow: Story = {
  ...FlowFull,
  globals: { viewport: { value: 'mobile1', isRotated: false } },
};

const rowCompositionContract: NonNullable<Story['play']> = async ({ canvas, userEvent, args }) => {
  if (args.preview)
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Preserve session and navigation context' }),
    );
  const gate = await canvas.findByRole('button', { name: 'Independent verification 1' });
  const row = gate.closest('li')!.getBoundingClientRect();
  const title = gate.getBoundingClientRect();
  if (title.left - row.left > 9)
    throw new Error('Requirements must not reserve an empty utility column');
  if (row.height < 36 || row.height > 40)
    throw new Error('A short requirement must retain compact activation geometry');
  const resource = await canvas.findByRole('button', { name: 'Verification material 1' });
  if (
    resource.getBoundingClientRect().left - resource.closest('li')!.getBoundingClientRect().left >
    9
  )
    throw new Error('Resources must not reserve an empty utility column');
};
export const RowCompositionFull: Story = { tags: ['contract'], play: rowCompositionContract };
export const RowCompositionPreview: Story = {
  args: { preview: true },
  tags: ['contract'],
  play: rowCompositionContract,
};
export const RowCompositionNarrow: Story = {
  ...RowCompositionPreview,
  globals: { viewport: { value: 'mobile1', isRotated: false } },
};
export const HistoryComposition: Story = {
  tags: ['contract'],
  play: async ({ canvas }) => {
    const result = await canvas.findByText('build · Agent · Attempt 1 · pass');
    const purpose = await canvas.findByText(
      'Implement the original session behaviour before manual verification.',
      { selector: 'p' },
    );
    if (purpose.getBoundingClientRect().top < result.getBoundingClientRect().bottom + 3)
      throw new Error('History purpose must occupy its own band with a gap after the result');
  },
};
export const UnavailableComposition: Story = {
  args: { scenario: 'unavailable' },
  tags: ['contract'],
  play: async ({ canvas }) => {
    const identity = await canvas.findByText('TASK-03 · admission');
    const source = (await canvas.findAllByText('This source is unavailable.'))[0]!;
    if (source.getBoundingClientRect().top < identity.getBoundingClientRect().bottom)
      throw new Error('Unavailable source must start below the Task identity');
  },
};

const richContextContract: NonNullable<Story['play']> = async ({
  canvas,
  canvasElement,
  userEvent,
  args,
}) => {
  if (args.preview)
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Preserve session and navigation context' }),
    );
  const opener = await canvas.findByRole('button', { name: 'Details' });
  await userEvent.click(opener);
  await canvas.findByRole('heading', { name: 'Step details' });
  await canvas.findByText('session-return.md');
  await canvas.findByText('nevo-agents-reviewer');
  await canvas.findAllByText('Confirm the browser back button restores the selected tab.');
  await canvas.findByRole('heading', { name: 'Declared work transitions' });
  await canvas.findByRole('heading', { name: 'Requirement decisions' });
  const evidence = await canvas.findByRole('button', { name: 'Verification instructions' });
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  evidence.focus();
  await userEvent.keyboard('{Enter}');
  await canvas.findByRole('heading', { name: 'Acceptance criteria' });
  await userEvent.click(await canvas.findByRole('button', { name: 'Back' }));
  await waitFor(() => {
    if (
      canvasElement.ownerDocument.activeElement !==
      canvas.getByRole('button', { name: 'Verification instructions' })
    )
      throw Error('Evidence focus lost');
  });
  const close = canvas.queryByRole('button', { name: 'Close secondary content' });
  await userEvent.click(
    args.preview
      ? canvas.getByRole('button', { name: 'Back' })
      : (close ?? canvas.getByRole('button', { name: 'Back' })),
  );
  await waitFor(() => {
    if (
      canvasElement.ownerDocument.activeElement !== canvas.getByRole('button', { name: 'Details' })
    )
      throw Error('Step opener focus lost');
  });
};
export const CompleteHumanFull: Story = {
  args: { scenario: 'rich-human' },
  tags: ['contract'],
  play: richContextContract,
};
export const CompleteHumanPreview: Story = {
  ...CompleteHumanFull,
  args: { scenario: 'rich-human', preview: true },
};
export const CompleteHumanNarrow: Story = {
  ...CompleteHumanFull,
  globals: { viewport: { value: 'mobile1', isRotated: false } },
};
export const CompleteHumanPreviewNarrow: Story = {
  ...CompleteHumanPreview,
  globals: { viewport: { value: 'mobile1', isRotated: false } },
};

const historyContextContract: NonNullable<Story['play']> = async ({
  canvas,
  canvasElement,
  userEvent,
  args,
}) => {
  if (args.preview) {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Preserve session and navigation context' }),
    );
    await userEvent.click(await canvas.findByRole('button', { name: 'More actions' }));
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole('menuitem', {
        name: 'Full task view',
      }),
    );
  }
  await canvas.findByRole('heading', { name: 'Preserve session and navigation context' });
  if (!canvasElement.querySelector('[data-layout="split"]')) {
    await userEvent.click(await canvas.findByRole('button', { name: 'More actions' }));
    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole('menuitem', {
        name: 'Task history',
      }),
    );
  }
  await canvas.findByRole('button', { name: 'Attempt details' });
  const history = canvas
    .getByRole('button', { name: 'Attempt details' })
    .closest('[data-workspace-surface]')!;
  await userEvent.click(within(history as HTMLElement).getByRole('button', { name: 'Show more' }));
  const details = await canvas.findAllByRole('button', { name: 'Attempt details' });
  await userEvent.click(details[1]!);
  await canvas.findByText('session-before.ts');
  await userEvent.click(await canvas.findByRole('button', { name: 'Full reference' }));
  await canvas.findByText('historical/session-before.ts');
  await userEvent.click(await canvas.findByRole('button', { name: 'Technical data' }));
  await canvas.findByText(/workflow_history/, { selector: 'pre' });

  const material = await canvas.findByRole('button', {
    name: 'Historical verification record · build · Attempt 2',
  });
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  material.focus();
  await userEvent.keyboard('{Enter}');
  await canvas.findByText('Material from the selected completed attempt.');
  await userEvent.click(
    canvasElement.querySelector('[data-layout="split"]')
      ? canvas.getByRole('button', { name: 'Close secondary content' })
      : canvas.getByRole('button', { name: 'Back' }),
  );
  await waitFor(() => {
    if (
      canvasElement.ownerDocument.activeElement !==
      canvas.getByRole('button', {
        name: 'Historical verification record · build · Attempt 2',
      })
    )
      throw Error('History resource focus lost');
  });
  const hide = canvas.getByRole('button', { name: 'Hide attempt details' });
  await userEvent.click(hide);
  if (canvasElement.ownerDocument.activeElement !== hide)
    throw Error('History collapse focus lost');
};
export const HistoricalAttempt: Story = { tags: ['contract'], play: historyContextContract };
export const HistoricalAttemptNarrow: Story = {
  ...HistoricalAttempt,
  globals: { viewport: { value: 'mobile1', isRotated: false } },
};
export const HistoryViaFullPreview: Story = { ...HistoricalAttempt, args: { preview: true } };

export const AgentPreview: Story = { args: { scenario: 'agent', preview: true } };
export const NextPreview: Story = { args: { scenario: 'not-started', preview: true } };
export const TerminalPreview: Story = { args: { scenario: 'terminal', preview: true } };
export const RichLongPreview: Story = {
  args: { scenario: 'rich-human', preview: true, stress: true },
};
export const RichNarrowPreview: Story = {
  args: { scenario: 'rich-human', preview: true, narrowPanel: true },
};

export const MixedReferences: Story = {
  args: { scenario: 'rich-human', mixedReferences: true },
};
export const MixedReferenceReaders: Story = {
  ...MixedReferences,
  tags: ['contract'],
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText('Session without a reader');
    if (canvas.queryByRole('button', { name: 'Session without a reader' }))
      throw Error('Unsupported reader must not offer navigation');
    if (canvas.queryByRole('button', { name: 'Missing material' }))
      throw Error('Unavailable material must not offer navigation');
    await userEvent.click(await canvas.findByRole('button', { name: 'Details' }));
    await canvas.findByText('Session evidence without a reader');
    if (canvas.queryByRole('button', { name: 'Session evidence without a reader' }))
      throw Error('Unsupported evidence reader must not offer navigation');
    if (canvas.queryByRole('button', { name: 'Missing evidence' }))
      throw Error('Unavailable evidence must not offer navigation');
    await canvas.findByRole('button', { name: 'Verification instructions' });
  },
};
