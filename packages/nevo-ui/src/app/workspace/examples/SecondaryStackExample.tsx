import { useState, useSyncExternalStore } from 'react';
import {
  AppContent,
  AppWorkspace,
  AppWorkspaceProvider,
  WorkspaceHeader,
  useSecondaryNavigation,
} from '../../index';
import { Button } from '../../../components';
import { AppShell } from '../../shell/AppShell';
import { createDemoStore, type DemoStore } from './DemoStore';
import { createDemoStacks, type DemoStacks } from './createDemoStacks';

function EntityLists({ store, stacks }: { store: DemoStore; stacks: DemoStacks }) {
  const navigation = useSecondaryNavigation();
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return (
    <div className="grid gap-5 p-5">
      <div className="flex flex-wrap gap-2">
        <Button onClick={store.refresh}>Refresh data</Button>
        <Button variant="secondary" onClick={() => store.removeTodo('t1')}>
          Remove Todo t1
        </Button>
        <Button variant="secondary" onClick={() => store.removeEvent('t1', 'e1')}>
          Remove Event e1
        </Button>
        <span data-revision>Snapshot {snapshot.revision}</span>
      </div>
      <section>
        <h2>Todos</h2>
        <div className="flex flex-wrap gap-2">
          {snapshot.todos.map((todo) => (
            <Button
              key={todo.id}
              variant="secondary"
              onClick={() => void navigation.open(stacks.todo, { id: todo.id })}
            >
              {todo.title}
            </Button>
          ))}
        </div>
      </section>
      <section>
        <h2>Users</h2>
        <div className="flex flex-wrap gap-2">
          {snapshot.users.map((user) => (
            <Button
              key={user.id}
              variant="secondary"
              onClick={() => void navigation.open(stacks.user, { id: user.id })}
            >
              {user.name}
            </Button>
          ))}
        </div>
      </section>
      <section>
        <h2>Items</h2>
        <div className="flex flex-wrap gap-2">
          {snapshot.items.map((item) => (
            <Button
              key={item.id}
              variant="secondary"
              onClick={() => void navigation.open(stacks.item, { id: item.id })}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
}

function DemoWorkspace({
  store,
  stacks,
  closeBehavior,
}: {
  store: DemoStore;
  stacks: DemoStacks;
  closeBehavior: 'page' | 'flow';
}) {
  return (
    <AppWorkspace split="primary" secondaryCloseBehavior={closeBehavior}>
      <AppWorkspace.Primary header={<WorkspaceHeader title="Secondary stack demo" />}>
        <AppContent>
          <EntityLists store={store} stacks={stacks} />
        </AppContent>
      </AppWorkspace.Primary>
      <AppWorkspace.Secondary header={<WorkspaceHeader title="Activity" />}>
        <div className="p-4">
          Default Secondary. Opening a Todo, User or Item replaces the entire contextual stack.
        </div>
      </AppWorkspace.Secondary>
    </AppWorkspace>
  );
}

export function SecondaryStackExample({
  width = 1400,
  closeBehavior = 'flow',
}: {
  width?: number;
  closeBehavior?: 'page' | 'flow';
}) {
  const [store] = useState(createDemoStore);
  const [stacks] = useState(() => createDemoStacks(store));
  return (
    <div style={{ width, maxWidth: '100%', height: 700 }}>
      <AppWorkspaceProvider>
        <AppShell
          navigation={<div className="p-5">Demo navigation</div>}
          style={{ height: '100%', width: '100%' }}
        >
          <DemoWorkspace store={store} stacks={stacks} closeBehavior={closeBehavior} />
        </AppShell>
      </AppWorkspaceProvider>
    </div>
  );
}
