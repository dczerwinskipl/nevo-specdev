---
id: product.specflow.ui.interaction-model
type: product
title: UI interaction model
status: draft
read_when:
  - designing a UI screen, its navigation, or its back behavior
  - choosing between an inline surface, an inspector, a sheet, and a page
  - defining what state is preserved across navigation
summary: >
  Responsive shell with independent navigation and workspace breakpoints, the product
  navigation hierarchy, context-preserving drill-down, and when to use floating,
  Secondary, pushed-detail, or full-workspace surfaces.
related:
  - product.specflow.ui.personas
  - product.specflow.ui.ai-session-ux
  - design-system.principles.ui-ux-guidelines
---

# UI interaction model

`status: draft` — working guidance, expanded as the code it governs lands. Screen-by-screen
contracts are filled in with the implementation.

## Interaction principles

- **Preserve context.** Drilling down keeps the user oriented; going back returns them
  to where they were, with scroll and selection intact.
- **Drill-down increases specificity**, not just volume — each level answers a more
  precise question.
- **Back follows the product hierarchy**, not raw browser history.
- **Do not expose the internal model as navigation.** Users navigate product concepts,
  not database entities or provider payloads.
- **A route is not automatically global navigation.** Full Session and Full Task can have stable
  product routes without earning persistent sidebar items. Task Preview and contextual inspectors
  remain local Secondary state; Full Task is the explicit main routed destination.
- **Preserve the current work context when possible.** Use Secondary or floating interaction for
  contextual exploration; use a main workspace route when the user explicitly promotes that context
  into their primary task.

## Responsive shell

Navigation collapse and workspace stacking are separate responsive decisions.

| Shell       | Navigation             | Workspace                                                                                                    |
| ----------- | ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Wide**    | Persistent navigation. | Primary + Secondary can be visible together.                                                                 |
| **Compact** | Drawer navigation.     | Primary + Secondary can still be visible together.                                                           |
| **Narrow**  | Drawer navigation.     | One workspace surface is visible at a time; active Secondary replaces Primary until Back returns to Primary. |

Do not equate "no persistent sidebar" with "mobile". Compact layouts can still support the full split
workspace.

The product hierarchy is identical across breakpoints. On narrow layouts, any information that would
otherwise exist only in a desktop Secondary needs an explicit affordance from the visible Primary
surface.

## Product terminology

Use **Nevo SpecFlow** for the product as a whole. The UI does not introduce a separate collective
brand or a separate Home/dashboard route.

Use **Workspace** for the Nevo UI layout model (`AppWorkspace`, Primary/Secondary, local workspace
stack) or for explicitly qualified repository/filesystem concepts such as workspace root. Product
surfaces should normally be named by their product concept: Specs Overview, Specification, Task
Detail, Full Session, Project Settings.

## Product hierarchy

Specification Overview owns `/specs/:specId`. Documents, Sessions, Changes
and Repository are feature-owned canonical Primary pages under that specification,
not tabs controlled by `?view`. They do not become global product areas.

TanStack Router owns routable Primary surfaces. Nevo UI Secondary Stack owns
contextual Task/Document previews, independent from URL search state.
Promoting a preview to Full is an explicit Primary route navigation.

The Specification design separates short Task Preview in Secondary from explicit Full Task
promotion into a main routed page (`/specs/:specId/tasks/:taskId`). Work defaults to
Specification history in Secondary. A Full Task deep link reads the Task by ID through the
authenticated Runtime detail API, not through the Workspace Task collection.

For the current spec-driven MVP, global product navigation stays deliberately small. The default
product entry is Specs Overview:

```text
Project
├── Specs
│   ├── Current / Archive                 collection views, not necessarily nav items
│   └── Specification
│       ├── Task details                  contextual Secondary
│       └── Session
│           ├── quick conversation        floating presentation where supported
│           └── Open full session         main product surface/route
│
└── Project settings
    ├── Configuration
    ├── AI / agents
    ├── Workflows
    ├── Repository / Git
    └── Integrations
```

A Full Session is a first-class workspace and may have its own URL, but Sessions are not a global
sidebar area while they remain owned by/spec-driven from Specifications.

The implemented increment has only Specs in global navigation; Project Settings awaits a real
surface. UI Playground is development-only direct navigation. Every Current/Archive Overview row
uses a real owning Specification link at `/specs/:specId`, including Open specification in overflow.
The Specification destination is an actual Workspace connected to the Runtime read API.
Work, Documents and Task details use typed projections; absent project read sources are shown
as unavailable rather than fabricated content. Runtime does not yet implement the workflow
mutations or the full Session conversation surface.

Changes, pull requests, documentation, files, Work details, and similar concepts are contextual
surfaces until a proven independent human task justifies promoting them into global navigation.

Within a Full Session:

```text
Session conversation Primary
└── Secondary local inspector
    ├── Context                     default on split-capable entry
    └── user-selected detail        Task / Handover / artifact / Work / future File preview / ...
```

Secondary changes because the user explicitly opens something. Normal agent activity must not
replace what the user is currently inspecting.

A Session reference may expose both conversation access and an explicit **Open full session** action.
On Wide, conversation access may use Floating Session to preserve the current Spec/Task context. On
Compact/Narrow, conversation access opens Full Session directly; there is no miniature floating
replacement.

## Surface choice

| Surface                  | Use for                                                                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Info / tooltip / popover | A short clarification; no navigation, no actions of substance.                                                  |
| Floating surface         | Quick interaction with related context, especially a Session, without abandoning the current workspace.         |
| Secondary                | Contextual detail that supports the Primary without replacing its product context on split layouts.             |
| Pushed / stacked detail  | Narrow representation of Secondary: it becomes the visible workspace surface and provides an explicit way back. |
| Main page / workspace    | A distinct product surface the user explicitly navigated/promoted to.                                           |

## State preservation

The router/URL owns main product navigation. Local Workspace Secondary state is intentionally not part
of the URL contract.

Preserve local selection, scroll, disclosure, and in-progress composer text while the relevant
component state remains alive where practical, but do not require browser navigation to serialize a
Task/detail inspector stack.

On Narrow, browser/system Back may first pop the active local pushed-detail stack before delegating
to router history. This keeps physical Back natural without turning Secondary into a route.

Deep links address stable main product resources. Raw provider/runtime identifiers must not define
navigation semantics merely because they exist internally.
