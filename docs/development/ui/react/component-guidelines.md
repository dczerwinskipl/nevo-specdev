---
id: development.ui.react.component-guidelines
type: development
title: React component guidelines
status: draft
read_when:
  - creating or restructuring a React component or module
  - deciding whether a helper component gets its own file
  - placing state or writing a hook
  - reviewing a React change
summary: >
  Small focused components, composition over configuration, split by responsibility not
  ceremony, feature-local vertical ownership, hooks by behavior, and where state lives.
related:
  - development.ui.ui-ux-guidelines
  - development.ui.tailwind.styling-guidelines
  - development.cli.node-tooling-guidelines
---

# React component guidelines

`status: draft` — working guidance, expanded as the code it governs lands. Same
"responsibilities, not a mandatory directory tree" spirit as the
[Node tooling guidelines](../../cli/node-tooling-guidelines.md).

## Core principles

- **Prefer small, focused components.** One primary concept per module.
- **Composition over configuration.** A component with a dozen boolean props that
  reshape it is usually two or three components.
- **Split by responsibility, not architectural ceremony.** Don't add `-Container`,
  `-View`, `-Wrapper` layers that only forward props.

## Module organization

- **Default:** one primary concept per file.
- A small helper component **may stay in the parent file** when it is only used there,
  has no independent state/lifecycle, and is short.
- A component **gets its own module** when it is reused, has meaningful state or
  effects, or is independently testable.
- **Feature-local vertical ownership:** keep a feature's components, hooks, view-models
  and tests together under `features/<domain>/`. Promote code upward to a shared
  location only when reuse is real, not anticipated.

## File size

An inspection trigger, not an extraction rule. A large cohesive component can be fine;
split when it mixes independent concerns, tangles orchestration with presentation, or
is hard to test because of unrelated effects.

## Visual vs orchestration

- **Visual components** take props and render. No data fetching, no routing knowledge.
- **Container components / feature hooks** own data access and orchestration, and keep
  it visible — don't bury a fetch three hooks deep.

## Hooks

Extract hooks **by behavior ownership** (`useSessionStream`, `useWorkTimeline`), not as
a `useEverything` catch-all. A hook that does five unrelated things is five hooks.

## View models

Transform raw/protocol data into a UI-facing model at a boundary that follows the
feature's change boundary. Stories and components consume the canonical UI model, never
raw provider payloads.

## State and effects

- Place state at the lowest common owner of the components that need it; lift only when
  genuinely shared.
- Effects are for **synchronization with external systems**, not for deriving values
  that could be computed during render.

## Accessibility & responsive

Semantic elements and roles; keyboard operable; hit targets comfortable; layout holds
at mobile and desktop widths.

## Testing

Follow the [testing guidelines](../../cli/testing-guidelines.md): pure view-model and
hook logic in fast unit tests; component behavior and accessibility via Storybook
interaction tests; inspect computed styles when exact visuals matter.

## Review checklist

- [ ] One primary concept per module?
- [ ] Composition instead of a configuration-heavy component?
- [ ] Feature-local ownership, not premature sharing?
- [ ] File size used only as an inspection trigger?
- [ ] Visual components free of data/routing concerns?
- [ ] Hooks split by behavior, no catch-alls?
- [ ] State at the right owner; effects only for synchronization?
- [ ] Accessible and responsive?
