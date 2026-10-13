---
id: design-system.implementation.react.secondary-navigation
type: engineering
title: Secondary navigation
status: current
read_when:
  - adding a contextual Secondary inspector to a workspace
  - navigating between nested inspector screens
  - debugging data refreshes, remounts or default Secondary behavior
summary: >
  Product-neutral in-memory Secondary screen catalogues and lifecycle, distinct from route navigation.
related:
  - design-system.principles.system-boundary
  - product.specflow.ui.interaction-model
---

# Secondary navigation

Secondary navigation is an ephemeral in-memory **single active flow**. It is not an application router.
Product routes remain owned by the application router. This is not the global navigation Drawer.

## Ownership

- `AppWorkspace.Primary` renders the main work surface.
- `AppWorkspace.Secondary` is the optional declarative base shown on split-capable layouts.
- A runtime Secondary flow temporarily takes precedence over the declarative base.
- `AppWorkspaceProvider` owns one active flow and its array of page descriptors. Pass `scopeKey={specId}` (or the owning route identity) when the provider stays mounted while the route context changes; a changed scope clears the transient flow immediately.
- Feature code defines available pages in `defineSecondaryStack`, usually in a separate module.
- A page descriptor contains a page name, small page-specific identifiers and an instance key. Do not store React elements or cached domain snapshots in navigation state.
- `useData(rootParams)` resolves current data **once per mounted entry** in a stable host; the header and content consume the same result. A refresh updates rendered props without a navigation transition.
- The pure `secondaryNavigationModel.ts` handles start/push/replace/pop and stale-entry invariants; the provider owns async guards, focus, scheduling and presentation.

## Consumer API

Define a catalogue outside the Primary React component, alongside its screen modules. The
Primary imports only the catalogue and calls `open`; the screen itself imports only the
navigation hook and its page types. The stack does not require an additional feature-owned
React Context. The public declaration is in `@nevo/ui`.

```tsx
interface TodoPages {
  details: Record<never, never>;
  history: Record<never, never>;
  event: { eventId: string };
}

const todoStack = defineSecondaryStack<{ id: string }, Todo, TodoPages>({
  id: 'todo',
  initial: 'details',
  useData: ({ id }) => useTodoSidebarData(id),
  screens: {
    details: { title: 'Todo', component: TodoDetails },
    history: { title: 'History', component: TodoHistory },
    event: { title: 'Event', component: TodoEvent },
  },
});

// In a Primary list or any descendant of AppWorkspaceProvider:
const navigation = useSecondaryNavigation();
void navigation.open(todoStack, { id: todo.id });

// Inside a registered Todo screen:
const stack = useSecondaryStack<TodoPages>();
void stack.navTo('history');
void stack.navTo('event', { eventId });
void stack.back();
void stack.close();
```

`open` always discards the prior flow and starts from its registered initial page.
`navTo('history')` pushes a page inside the current catalogue. Alternatively,
`navTo(changesStack, { id: changeId })` pushes the **initial screen of another module**
without discarding the current flow. Back then returns from File to Changes to Task,
even when the three modules use independent data subscriptions.
`replace` changes only the top page within its current catalogue.
`back` pops a page, and on the root closes the runtime flow.
`close` clears the runtime flow. Asynchronous callbacks from disposed screens cannot operate
on a newer flow.

`AppWorkspace secondaryCloseBehavior="page"` makes the host's Close control return from the active
page to its parent, or close the flow when already at its root. Use it for workspace readers whose
Close means returning to the source surface. The default `"flow"` retains whole-flow Close.
This changes only the host control; explicit `useSecondaryStack().close()` still clears the flow.

A screen may declare an optional `header` component in its definition. The screen
catalogue also declares `actions: ({ data, params }) => WorkspaceHeaderAction[]` and optionally
`actionLabels`. The action declaration is **pure** (no hooks, no side effects) and uses
the same live `useData` result as Header and Content. A custom Header receives only
`{ data, params }` and renders **product content only**, for example a
`WorkspaceHeaderIdentity` with title, status and subtitle. It must not render its own
`WorkspaceHeader`, Back/Close, or duplicate page actions. `AppWorkspace` automatically
renders the shared header frame and injects actions in both desktop and collapsed mobile
without requiring custom headers to forward props or inspecting React elements.

`AppWorkspace` continues to own the system Back/Close controls. When the mobile header
scrolls out of view, the entire declared action set moves to the floating overflow menu;
system Back stays outside it and Close may appear alongside the product actions.
Actions are unavailable while `useData` is not `ready`, avoiding stale callbacks after data
loss. Default Secondary retains its independent declarative header.

For ordinary **application route changes**, the application router's blocking adapter must
await `useSecondaryNavigation().canLeaveScope()` _before_ committing navigation. This
checks the active page's leave guard but does not change the Secondary stack. Once
the route transition has been approved, changing the provider's `scopeKey` invalidates
its flow. Forced context invalidation (logout, revoked global permissions, destroyed
workspace scope) intentionally bypasses leave guards and removes the flow.
Do not treat the `scopeKey` change itself as an ordinary guarded user navigation.
Browser/system Back implementation belongs in that router adapter, not inside feature screens.

`useSecondaryLeaveGuard` optionally registers a guard for the active page. Navigation checks
the guard before replacing, popping or closing that page; denied transitions leave the state intact.
For an editable screen with a local draft, opt into `preserveOnDataLoss: true` in its
screen definition. Once ready, the screen and its leave guard remain mounted but
hidden/inert during temporary `loading` or `error`, with a visible status message.
`unavailable` represents a confirmed missing entity; `access-denied` represents lost
permission. Both always dispose the screen and its local draft, regardless of this
flag. The feature still owns its authoritative data and permission invalidation;
it must map confirmed authorization loss to `access-denied` rather than a generic
network error. Hidden/inert is not an acceptable protection for revoked data.

This retention option applies **only to the current screen**. After Back, earlier
entries retain identifiers but can remount. If scroll, filters or an unsaved form must
survive Back, the product should explicitly own that state outside the unmounted page,
scoped to the flow. Full offscreen React subtree retention is intentionally deferred.
Avoid synchronizing two owners of the Secondary with effects in product screens.

## Refresh and missing data

The screen host always invokes the stack's `useData` hook while active.
Do not call navigation operations when data changes. `useData` MUST be a normal React hook
whose identity remains stable within one registered stack (TanStack Query, store subscriptions,
or equivalent). The optional header and screen consume one resolved result from an internal host,
not separate hook calls. Use a pure subscription or stable data hook: no data snapshots
in navigation entries.
Do not define screen components or hook factories inside a rerendering React component.
Its discriminated result is one of `loading`, `ready`, `unavailable`, `error` or `access-denied`.
No result automatically navigates away. Ordinary refetches should retain a `ready` result when
the previous usable data remains available, then update the `data` prop.

Keep IDs in root/page navigation params. Resolve nested events/files against **current** data in
the owning screen; their absence should show an unavailable state, not stale snapshots.
An entity missing from a filtered list is not necessarily deleted from its authoritative source.

The identity of the active React page is independent of refreshed data. A new page navigation
may remount screens; an ordinary data update must not.

## Presentation

AppWorkspace owns the responsive split/stacked choice and automatic header controls.
On Narrow, the active runtime Secondary replaces visible Primary and Back occupies the navigation
position instead of the global hamburger. On desktop/split, Back and Close are provided by the
workspace header. Default Secondary is not part of the runtime page stack.

Browser history/Back interception and serialization of transient pages are **out of scope**.
The current implementation preserves the mounted active page across ordinary `ready`
refreshes. Without `preserveOnDataLoss`, non-ready states replace the screen content
and can discard its local draft or leave guard. `access-denied` and `unavailable`
always unmount current content, even if retention is enabled. A previous screen reached via Back is
mounted afresh unless the product stores its state outside that component. This prototype
does not persist offscreen screen-local state or intercept browser/system Back.

Stack catalogue types constrain `navTo` for each declared set of pages, but the generic
`useSecondaryStack<TPages>()` parameter is currently asserted by the caller and is
not tied statically to its rendered catalogue. The runtime rejects unknown screen names.
Do not claim full end-to-end catalogue-type inference.

## Agent checklist

1. Read this document and `design-system.implementation.react.component-guidelines`.
2. Keep feature stack catalogue, screen components, and Primary list in separate modules when substantial.
3. Open with the root entity ID from Primary, not with a React node or stale domain object.
4. Use `navTo(page, { childId })` for contextual depth. Read the current entity from `useData`.
5. Treat missing nested records as a screen state, not navigation.
6. Render no custom Back or Close button when the workspace already provides the action.
7. Add Storybook interaction cases for root replacement, Back/Close, refresh without remount,
   and unavailable entities. Confirm narrow stacked and wide split.
8. Do not call removed `setSecondary/pushSecondary/popSecondary/closeSecondary` APIs.

## Verification

The canonical Storybook examples in
`packages/nevo-ui/src/app/workspace/examples/SecondaryStackExample.stories.tsx`
and `CrossFeatureNavigationExample.stories.tsx` exercise deep Todo navigation,
Task → Changes → File across independent modules, scoped invalidation, refresh
without remounts, unavailable nested events/root entities and mobile Back.
`SecondaryHeaderActionsExample.stories.tsx` verifies declarative Save/Refresh/Open full view
actions on desktop and collapsed mobile headers.
`WorkspaceContext.contract.stories.tsx` covers a shared header/body data source,
retention of a hidden editable draft during temporary failures, and its disposal on revoked access. The CRM example provides an independent
consumer. Keep every legacy runtime-node navigation API removed from code, tests and exports.

## Cross-feature composition

Independent modules export their screen catalogues (or factories) and accept only the
navigation capabilities they need. Wire Task → Changes → File at the application
composition root rather than importing all modules into one catalogue; use lazy
callbacks for cyclic connections if necessary. Do not add a global registry or
new feature contexts simply to navigate between these modules.

The public generic `useSecondaryStack<Pages>()` currently relies on the caller's
asserted page type, as noted above. Keep the runtime unknown-page check; complete
static catalogue coupling is a separate follow-up, not a prerequisite for this flow.

### Measured split capability

Products can call the public `useWorkspaceCapabilities()` inside the shell to read
`supportsSplit`. It uses the same measured available workspace width and threshold
as `AppWorkspace`, including a narrow workspace in a wide browser window. Use it to
expose an overflow entry for a default Secondary surface on stacked layouts. Do not
import shell internals or derive this decision from browser width.

Secondary content that establishes an inline-size container must declare its supported
content width (for example `w-content-standard max-w-full`) and use `AppWorkspaceBody`
for scrolling. An intrinsic-width surface cannot measure content through size containment.

Use `AppWorkspaceBody scroll="area"` for the shared `ScrollArea` edge indicators and
viewport on a desktop surface. On stacked layouts the host already owns `ScrollArea`;
the body then contributes content and padding without nesting another scroll viewport.
