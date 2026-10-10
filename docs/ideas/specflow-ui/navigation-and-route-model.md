---
id: ideas.specflow-ui.navigation-route-model
type: product
title: SpecFlow UI navigation and route model
status: draft
scope: specflow
areas:
  - ui
tags:
  - information-architecture
  - routing
  - primary-secondary
  - session
  - responsive
read_when:
  - implementing SpecFlow product routing or Back behavior
  - validating that every product surface is reachable
  - deciding which interaction state belongs in the URL versus local UI state
  - designing cross-screen navigation between Specs, Specification, Task, Session, and Settings
summary: >
  Cross-screen navigation contract for SpecFlow UI. Defines the default product entry point,
  routable product surfaces, Primary/Secondary drill-down, direct Full Session access,
  local inspector stacks, responsive representation, and Back behavior without freezing
  exact URL syntax or Session-creation flow.
related:
  - ideas.specflow-ui
  - ideas.specflow-ui.information-navigation-inventory
  - ideas.specflow-ui.spec-task-screen-structure
  - ideas.specflow-ui.full-session-screen-structure
  - product.specflow.ui.interaction-model
  - design-system.principles.system-boundary
---

# SpecFlow UI navigation and route model

## 1. Purpose

This document is the cross-screen reachability contract for the current SpecFlow UI proposal.

Individual screen specs own their information hierarchy and local interactions. This document owns
how those surfaces connect, which context is preserved, and which navigation intent must survive
reload/deep linking.

It intentionally does **not** freeze:

- exact URL syntax;
- exact visual composition of Session/specification creation controls;
- exact header/menu affordances beyond the product intent they must expose.

## 2. Product terminology

Use **Nevo SpecFlow** for the product as a whole. This document defines its UI interaction model;
it does not introduce a second collective UI brand or another Home/dashboard route.

Reserve **Workspace** primarily for:

- Nevo UI layout mechanics such as `AppWorkspace`, Primary, Secondary, and local workspace stacks;
- explicitly qualified repository/filesystem terms such as workspace root.

Product surfaces should normally be named by the thing the user is doing or inspecting:

- Specs Overview;
- Specification;
- Task Detail;
- Full Session;
- Project Settings.

Existing document/file names containing `workspace` do not need a mechanical rename. New
user-facing copy and navigation should avoid using Workspace as a competing product-area name.

## 3. Global entry and navigation

The default product UI entry is **Specs Overview**.

There is no separate product Home area in the current information architecture.

Persistent product navigation remains deliberately small:

Project switching is a future capability and is not part of the current MVP global navigation.

```text
Specs

Project Settings
```

Sessions, Tasks, Work, Files, Changes, workflow definitions, and artifacts may have routable/detail
surfaces without becoming global navigation items.

The implemented increment currently exposes only Specs in normal product navigation. Project
Settings is not a placeholder sidebar item. `/ui-playground` is a directly routable development
surface, not a product navigation entry.

## 4. Reachability matrix

| Surface                   | Normal entry                                                                                                   | Representation                                            |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Specs Overview            | global Specs / default product entry                                                                           | Primary                                                   |
| Specification             | Specification row/identity or stable route                                                                     | Primary                                                   |
| Task Preview              | Task row from Specification or explicit Task target from another owning context                                | Secondary on split layouts; pushed local detail on narrow |
| Full Task                 | explicit promotion from Preview, Task menu, or stable resource URL                                             | main routable Primary                                     |
| Floating Session          | existing-Session conversation target on Wide only                                                              | floating presentation outside AppWorkspace stack          |
| Full Session              | existing Session target on Compact/Narrow; explicit full-session action; Floating Session header; stable route | main Primary + optional Secondary                         |
| Session Context           | Full Session Context action/default split entry                                                                | Secondary or pushed local detail                          |
| Session inspection detail | explicit user click on Work summary, Task, File, Handover, artifact, verification, etc.                        | replaces current Secondary; never creates a third pane    |
| Project Settings          | global Project Settings / stable section intent                                                                | Primary                                                   |

The table defines reachability, not exact route strings.

A product row/identity keeps a stable neutral destination. For Specs Overview specifically, the
canonical Spec row always enters the owning Specification; dynamic summary state does not introduce
Task/issue deep links inside that row.

## 5. Specification and Task navigation

The implementation separates canonical Primary pages from local Secondary
inspectors. Specification Overview is `/specs/:specId`; Documents List and
Full Document use `/specs/:specId/documents` and
`/specs/:specId/documents/:documentId`. Full Task uses
`/specs/:specId/tasks/:taskId`. Sessions List, Changes and Repository have
their own sibling Primary routes. Legacy `?view` URLs redirect.

On split layouts Task/Document previews live in Secondary. On Narrow the same
inspectors are locally pushed without becoming routes. A new Primary route
disposes the previous local inspector state.

A Specs Overview row always opens the Specification Primary. It must not redirect the user to
whichever Task/issue happens to be highest priority at that moment, and ordinary status/reason prose
inside that row is non-interactive.

The Specification entry route is `/specs/:specId?collection=current|archive`, and the explicit
Full Task route is `/specs/:specId/tasks/:taskId`. The Task read is independent of the
Specification Workspace projection. Legacy `?view=task&task=...` links redirect to the
canonical Full Task URL. The collection is optional return context, not Task identity.

After entering the Specification, its Task collection and attention/current-work context make the
responsible Task(s) explicit. Selecting a Task row there opens Task Detail. Other owning contexts
such as Session Context may also expose an explicit Task target, but Specs Overview does not bypass
the Specification by deep-linking from dynamic summary state.

On a split-capable layout:

```text
Specification Primary
+ Task Detail Secondary
```

On a narrow layout, Task Detail becomes the visible pushed local surface.

Opening Task Detail is navigation/inspection only. It must not perform the workflow action that the
Task may later offer.

## 6. Task evidence drill-down

Task evidence uses the same Secondary slot as Task Detail. It does not create a nested third pane.

```text
Task Detail root
  -> Diff / Changes
  -> Handover
  -> Verification
  -> Artifact
  -> File
      -> Back
Task Detail root
```

On split layouts, an evidence/detail target temporarily replaces Task Detail in Secondary while the
Specification or Session remains Primary.

On narrow layouts, the same interaction is a pushed-detail stack.

Closing the whole Secondary context returns to the owning Primary. Back inside the local detail stack
returns to Task Detail first.

## 7. Session access

### Existing Session

A related/current Session reference exposes conversation access and may also expose an explicit
**Open full session** action.

On **Wide**, conversation access opens Floating Session so the current Specification/Task context can
remain visible.

On **Compact and Narrow**, there is no Floating Session equivalent. Conversation access opens Full
Session directly. Do not invent a modal, sheet, or miniature floating chat for these widths.

Floating Session also exposes Open full session in its own header. Floating is an alternate Wide
presentation of the same Session, not a required hierarchy step.

### Starting a new Session

The product must support an explicit human entry such as **New session** and workflow-owned start
actions such as **Start implementation** or **Start review**.

The interaction should reuse one Session-start model rather than maintaining separate prompt/composer
implementations in multiple dialogs:

- user chooses the agent/provider when a choice is required;
- Nevo allocates its own canonical Session identity before provider-native identity is known;
- provider-native Session identity remains adapter/runtime detail;
- workflow start actions may supply backend-owned default/bootstrap prompts and execution context;
- user-authored text should use the normal/shared composer interaction rather than a one-off prompt
  textarea embedded in every start modal.

Exact visual composition and optional advanced fields remain product-design details.

## 8. Full Session navigation

Full Session is a first-class routable product surface but not a global sidebar destination.

On split-capable entry with no user-selected inspection detail:

```text
Conversation Primary | Context Secondary
```

Context may be closed and should remain closed until explicitly reopened.

Secondary is one local inspection surface. User actions can replace Context with a more specific
detail, for example Task, Handover, artifact, verification, Work detail, command/search group, or
future File preview. Back walks this local detail stack.

Normal Session activity must never auto-switch Secondary. A pending human interaction is surfaced in
Primary and may offer an explicit action to open additional detail; it does not forcibly steal the
user's current inspector.

On narrow layouts, Conversation is the Full Session entry. Context and inspection details are pushed
local surfaces opened by explicit user actions.

## 9. Full Session return context

Router history owns main product navigation only.

Returning from Full Session navigates back to the previous routable product surface, for example the
Specification. The product does **not** promise to serialize or restore the previously open Task or
other Secondary detail.

If local component state happens to survive while the parent surface stays mounted, preserving it is
fine, but this is not a routing contract and must not require Secondary state in the URL.

A direct Full Session route has normal product parent orientation (for example the owning
Specification when available) without inventing a transient Secondary selection.

## 10. Route state versus local state

The router/URL describes **main navigation**. Secondary/pushed-detail state belongs to the local
Workspace stack and is not encoded in product URLs.

Routable state includes, as appropriate:

- Specs collection / Current versus Archive (`current` / `archive`);
- selected Specification;
- Full Task (`specId` and `taskId`);
- Full Session;
- Project Settings and a stable Settings section.

Local state includes:

- selected Task Preview Secondary;
- Context/detail inspector stack;
- Handover/artifact/Work/File detail opened in Secondary;
- Floating Session position/size/minimized order;
- transient disclosure, hover, and focus state.

Reload/direct URL entry reconstructs the routable surface, not the previous Secondary stack.

On Narrow, the implementation may bridge the local pushed-detail stack into browser/system Back
handling without changing the URL. Such history-state integration is an implementation mechanism,
not a deep-link contract.

## 11. Back and Close semantics

Product Back inside Secondary follows the local inspection stack.

Examples:

- Handover detail Back -> Task Detail;
- Task Detail Back/Close -> owning Primary;
- Session inspection detail Back -> previous local inspector state;
- Floating Session Close -> underlying Wide context remains.

Browser/system Back normally follows router history. On **Narrow**, when a local pushed Secondary
stack is active, the product should first give that local stack the opportunity to pop/close before
leaving the current routed surface. The URL still represents only the Primary route.

Implement this with router/history integration that preserves normal browser semantics; do not infer
that Secondary therefore becomes a URL-addressable route.

## 12. Deliberately unresolved

This navigation model does not decide:

- exact visual composition of new Session and new Specification start controls;
- provider-error/limit handover to another agent; reliable failure classification/context transfer
  is not yet sufficient to design that flow;
- final route path syntax;
- create/archive Specification visual treatment beyond the creation semantics documented in the
  Specs/Specification specs;
- exact future File preview / Open-in-IDE implementation.
