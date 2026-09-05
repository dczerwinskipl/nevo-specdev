---
id: product.dashboard.interaction-model
type: product
title: Dashboard interaction model
status: draft
read_when:
  - designing a dashboard screen, its navigation, or its back behavior
  - choosing between an inline surface, an inspector, a sheet, and a page
  - defining what state is preserved across navigation
summary: >
  Responsive shell (wide with contextual inspector / narrow), the product navigation
  hierarchy, context-preserving drill-down, and when to use a tooltip vs. inspector vs.
  sheet vs. full page. Condensed from the upstream Nevo interaction model.
related:
  - product.dashboard.personas
  - product.dashboard.ai-session-ux
  - development.ui.ui-ux-guidelines
---

# Dashboard interaction model

`status: draft` — condensed from the upstream Nevo interaction model. Screen-by-screen
contracts are filled in during migration.

## Interaction principles

- **Preserve context.** Drilling down keeps the user oriented; going back returns them
  to where they were, with scroll and selection intact.
- **Drill-down increases specificity**, not just volume — each level answers a more
  precise question.
- **Back follows the product hierarchy**, not raw browser history.
- **Do not expose the internal model as navigation.** Users navigate product concepts
  (specifications, tasks, sessions), not database entities or provider payloads.

## Responsive shell

| Shell               | Layout                                                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wide / desktop**  | Persistent primary navigation, a main workspace, and a **contextual inspector** on the right for details that shouldn't replace the workspace. |
| **Narrow / mobile** | Single-column. The inspector's content becomes a sheet or a pushed sub-page. Navigation collapses.                                             |

The hierarchy is identical across breakpoints; only density and whether a level is
inline vs. behind a tap changes.

## Product hierarchy

```text
Specifications ─► Specification overview ─► Tasks (list/board) ─► Task details
AI sessions   ─► Chat / session workspace ─► Work (summary ─► expanded ─► details ─► action details)
Changes       ─► Pull request
Documentation
```

## Surface choice

| Surface                    | Use for                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------- |
| Info / tooltip / popover   | A short clarification; no navigation, no actions of substance.                     |
| Right inspector            | Details about the current selection that support the workspace without leaving it. |
| Sheet / full-screen detail | A focused sub-task on mobile, or a large detail that would crowd the inspector.    |
| Main page / workspace      | A distinct product surface the user navigated to.                                  |

## State preservation

Selection, expansion state, scroll position, and in-progress composer text survive
navigation away and back, and survive a reload where the URL can express the state.
Deep links address product concepts, never internal ids.
