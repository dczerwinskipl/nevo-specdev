import { useCallback, useState, useSyncExternalStore } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppShell } from '../shell/AppShell';
import { AppWorkspace } from './AppWorkspace';
import { WorkspaceHeader } from './WorkspaceHeader';
import { defineSecondaryStack } from './SecondaryStack';
import {
  AppWorkspaceProvider,
  useSecondaryLeaveGuard,
  useSecondaryNavigation,
  useSecondaryStack,
} from './WorkspaceContext';

interface Pages {
  first: Record<never, never>;
  second: Record<never, never>;
  guarded: Record<never, never>;
}

function FirstScreen() {
  const navigation = useSecondaryStack<Pages>();
  return (
    <div>
      <p>Stack level 1</p>
      <button type="button" onClick={() => void navigation.navTo('second')}>
        Push level 2
      </button>
    </div>
  );
}
function SecondScreen() {
  return <p>Stack level 2</p>;
}
function GuardedScreen() {
  const [allow, setAllow] = useState(false);
  useSecondaryLeaveGuard(useCallback(() => allow, [allow]));
  return (
    <div>
      <p>Protected editor</p>
      <button type="button" onClick={() => setAllow(true)}>
        Allow exit
      </button>
    </div>
  );
}

const demoStack = defineSecondaryStack<Record<never, never>, string, Pages>({
  id: 'workspace-contract',
  initial: 'first',
  useData: () => ({ status: 'ready', data: 'contract' }),
  screens: {
    first: { title: 'Layer one', component: FirstScreen },
    second: { title: 'Layer two', component: SecondScreen },
    guarded: { title: 'Protected editor', component: GuardedScreen },
  },
});
const guardedStack = defineSecondaryStack<
  Record<never, never>,
  string,
  { guarded: Record<never, never> }
>({
  id: 'guarded-contract',
  initial: 'guarded',
  useData: () => ({ status: 'ready', data: 'contract' }),
  screens: {
    guarded: { title: 'Protected editor', component: GuardedScreen },
  },
});

function ContractWorkspace() {
  const navigation = useSecondaryNavigation();
  return (
    <AppShell navigation={<div>Navigation</div>} style={{ height: 600, width: 1280 }}>
      <AppWorkspace split="primary">
        <AppWorkspace.Primary header="Primary">
          <div className="grid gap-3 p-5">
            <button type="button" onClick={() => void navigation.open(demoStack, {})}>
              Open first secondary
            </button>
            <button type="button" onClick={() => void navigation.open(guardedStack, {})}>
              Open guarded secondary
            </button>
            <button
              type="button"
              onClick={() =>
                void navigation.canLeaveScope().then((allowed) => {
                  const output = document.querySelector('[data-route-leave-result]');
                  if (output) output.textContent = allowed ? 'route allowed' : 'route blocked';
                })
              }
            >
              Check route leave
            </button>
            <output data-route-leave-result />
          </div>
        </AppWorkspace.Primary>
        <AppWorkspace.Secondary header="Default">
          <p>Default secondary content</p>
        </AppWorkspace.Secondary>
      </AppWorkspace>
    </AppShell>
  );
}

const meta = {
  title: 'Nevo UI/Internal/Workspace/Navigation contracts',
  tags: ['contract', '!autodocs'],
  parameters: { a11y: { test: 'off' } },
} satisfies Meta;
export default meta;
type Story = StoryObj;

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function frame() {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export const PushPopAndFocus: Story = {
  render: () => (
    <AppWorkspaceProvider>
      <ContractWorkspace />
    </AppWorkspaceProvider>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open first secondary' }));
    assert(canvas.getByText('Stack level 1'), 'First page must appear');
    const push = canvas.getByRole('button', { name: 'Push level 2' });
    await userEvent.click(push);
    assert(canvas.getByText('Stack level 2'), 'Second page must appear');
    await userEvent.click(canvas.getByRole('button', { name: 'Back' }));
    await frame();
    assert(canvas.getByText('Stack level 1'), 'Back must restore the previous page');
    assert(
      document.activeElement?.textContent === 'Push level 2',
      'Back must restore focus to the initiating control',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Close secondary content' }));
    assert(canvas.getByText('Default secondary content'), 'Close must reveal default Secondary');
  },
};

export const GuardBlocksCloseAndReplacement: Story = {
  render: () => (
    <AppWorkspaceProvider>
      <ContractWorkspace />
    </AppWorkspaceProvider>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open guarded secondary' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Check route leave' }));
    assert(canvas.getByText('route blocked'), 'An ordinary route change must respect the guard');
    await userEvent.click(canvas.getByRole('button', { name: 'Close secondary content' }));
    assert(
      canvas.getByRole('heading', { name: 'Protected editor' }),
      'The guard must prevent closing',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Open first secondary' }));
    assert(
      canvas.getByRole('heading', { name: 'Protected editor' }),
      'The guard must prevent replacement',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Allow exit' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Check route leave' }));
    assert(canvas.getByText('route allowed'), 'An allowed route may leave');
    await userEvent.click(canvas.getByRole('button', { name: 'Close secondary content' }));
    assert(canvas.getByText('Default secondary content'), 'A passing guard must allow closing');
  },
};

interface EditableSnapshot {
  status: 'ready' | 'error' | 'unavailable' | 'access-denied';
  value: string;
}
function createEditableSource() {
  let snapshot: EditableSnapshot = { status: 'ready', value: 'Original draft' };
  const listeners = new Set<() => void>();
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    setAvailable: (available: boolean) => {
      snapshot = { ...snapshot, status: available ? 'ready' : 'error' };
      for (const listener of listeners) listener();
    },
    setStatus: (status: EditableSnapshot['status']) => {
      snapshot = { ...snapshot, status };
      for (const listener of listeners) listener();
    },
  };
}
type EditableSource = ReturnType<typeof createEditableSource>;
interface EditorPages {
  details: Record<never, never>;
}
let editorMountId = 0;

function PersistentEditor() {
  const [mount] = useState(() => ++editorMountId);
  const [draft, setDraft] = useState('Original draft');
  const [allow, setAllow] = useState(false);
  useSecondaryLeaveGuard(useCallback(() => !draft.endsWith('!') || allow, [draft, allow]));
  return (
    <div>
      <input aria-label="Draft" onChange={(e) => setDraft(e.target.value)} value={draft} />
      <output data-editor-mount>{mount}</output>
      <button type="button" onClick={() => setAllow(true)}>
        Allow editor exit
      </button>
    </div>
  );
}
function createEditableStack(source: EditableSource) {
  function useEditorData() {
    const data = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
    return data.status === 'ready'
      ? { status: 'ready' as const, data: data.value }
      : { status: data.status, message: 'Editing data unavailable.' };
  }
  return defineSecondaryStack<Record<never, never>, string, EditorPages>({
    id: 'editable-status-contract',
    initial: 'details',
    useData: useEditorData,
    screens: {
      details: {
        title: 'Persistent editor',
        component: PersistentEditor,
        preserveOnDataLoss: true,
      },
    },
  });
}

function EditableContractFixture() {
  const [source] = useState(createEditableSource);
  const [stack] = useState(() => createEditableStack(source));
  const navigation = useSecondaryNavigation();
  return (
    <AppShell navigation={<div>Navigation</div>} style={{ height: 600, width: 1280 }}>
      <AppWorkspace split="primary">
        <AppWorkspace.Primary header="Primary">
          <div className="grid gap-3 p-5">
            <button type="button" onClick={() => void navigation.open(stack, {})}>
              Open editor
            </button>
            <button type="button" onClick={() => source.setAvailable(false)}>
              Make data unavailable
            </button>
            <button type="button" onClick={() => source.setAvailable(true)}>
              Restore data
            </button>
            <button type="button" onClick={() => source.setStatus('access-denied')}>
              Revoke access
            </button>
          </div>
        </AppWorkspace.Primary>
        <AppWorkspace.Secondary header="Default">
          <p>Default secondary content</p>
        </AppWorkspace.Secondary>
      </AppWorkspace>
    </AppShell>
  );
}

export const EditorDraftSurvivesDataLoss: Story = {
  render: () => (
    <AppWorkspaceProvider>
      <EditableContractFixture />
    </AppWorkspaceProvider>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open editor' }));
    // Let the workspace finish its entry focus before typing into the editor.
    await frame();
    const original = canvasElement.querySelector('[data-editor-mount]')?.textContent;
    assert(original, 'Editor must mount');
    const draft = canvas.getByRole('textbox', { name: 'Draft' });
    await userEvent.clear(draft);
    await userEvent.type(draft, 'Changed!');
    assert((draft as HTMLInputElement).value === 'Changed!', 'The dirty draft must be entered');
    await userEvent.click(canvas.getByRole('button', { name: 'Make data unavailable' }));
    await canvas.findByText('Editing data unavailable.');
    await userEvent.click(canvas.getByRole('button', { name: 'Back' }));
    assert(
      canvas.getByText('Editing data unavailable.'),
      'Dirty hidden editor guard must still block Back',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Restore data' }));
    assert(
      (await canvas.findByRole<HTMLInputElement>('textbox', { name: 'Draft' })).value ===
        'Changed!',
      'Draft must survive',
    );
    assert(
      canvasElement.querySelector('[data-editor-mount]')?.textContent === original,
      'Editor must not remount',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Allow editor exit' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Back' }));
    assert(canvas.getByText('Default secondary content'), 'Allowed exit closes the flow');
  },
};

export const RevokedAccessDiscardsEditor: Story = {
  render: () => (
    <AppWorkspaceProvider>
      <EditableContractFixture />
    </AppWorkspaceProvider>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open editor' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Revoke access' }));
    assert(
      canvas.getByRole('alert').textContent?.includes('Editing data unavailable.'),
      'Denied state must be explained',
    );
    assert(
      !canvasElement.querySelector('input[aria-label="Draft"]'),
      'Denied data must unmount the editor',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Back' }));
    assert(
      canvas.getByText('Default secondary content'),
      'Revocation disposes previous leave guard',
    );
  },
};

let sharedHostCount = 0;
interface SharedHostPages {
  details: Record<never, never>;
}
const sharedHostStack = defineSecondaryStack<
  Record<never, never>,
  { instance: number },
  SharedHostPages
>({
  id: 'one-shared-data-host',
  initial: 'details',
  useData: () => {
    const [instance] = useState(() => ++sharedHostCount);
    return { status: 'ready', data: { instance } };
  },
  screens: {
    details: {
      title: 'Shared data',
      header: ({ data }) => <WorkspaceHeader headingLevel={2} title={`Host ${data.instance}`} />,
      component: ({ data }) => <p data-host-content>{`Host ${data.instance}`}</p>,
    },
  },
});
function SharedHostWorkspace() {
  const navigation = useSecondaryNavigation();
  return (
    <AppShell navigation={<div>Navigation</div>} style={{ height: 600, width: 1280 }}>
      <AppWorkspace split="primary">
        <AppWorkspace.Primary header="Primary">
          <button type="button" onClick={() => void navigation.open(sharedHostStack, {})}>
            Open shared host
          </button>
        </AppWorkspace.Primary>
        <AppWorkspace.Secondary header="Default">Default activity</AppWorkspace.Secondary>
      </AppWorkspace>
    </AppShell>
  );
}
export const HeaderAndBodyShareOneDataHost: Story = {
  render: () => (
    <AppWorkspaceProvider>
      <SharedHostWorkspace />
    </AppWorkspaceProvider>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open shared host' }));
    const body = canvasElement.querySelector('[data-host-content]');
    assert(body, 'Shared data content should be mounted');
    const header = canvas.getByRole('heading', { name: /^Host \d+$/ });
    assert(
      body.textContent === header.textContent,
      'Header and content must share the same data instance',
    );
  },
};
