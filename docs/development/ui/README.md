---
id: docs.development-ui-readme
type: hub
title: UI engineering documentation
status: current
summary: >
  Cross-UI engineering guidance, then technology-specific conventions for React,
  Tailwind, and Storybook. Implementation only — product UX contracts live under
  product/dashboard/.
---

# UI engineering

How UI is **built** in this repository. What the UI should _do_ — personas, screen
contracts, AI-session behavior — is under
[`../../product/dashboard/`](../../product/dashboard/) and
[`../../product/cli/`](../../product/cli/).

| Doc / area                                          | Covers                                                                                        |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [UI/UX engineering guidelines](ui-ux-guidelines.md) | Information hierarchy, semantic tokens, spacing, progressive disclosure, visual verification. |
| [`react/`](react/)                                  | Component composition, module organization, hooks, state ownership.                           |
| [`tailwind/`](tailwind/)                            | Class composition pipeline, variants, tokens, `@apply` policy.                                |
| [`storybook/`](storybook/)                          | Story hierarchy, fixtures, interaction tests, visual verification.                            |

These are the conventions the dashboard UI follows; each expands with concrete file
paths once the corresponding code lands.
