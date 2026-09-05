---
id: development.ui.ui-ux-guidelines
type: development
title: UI/UX engineering guidelines
status: draft
read_when:
  - implementing or reviewing a UI screen or component
  - choosing typography, color, or spacing
  - designing progressive disclosure or an inspector
  - doing visual verification before marking UI work done
summary: >
  Engineering rules for building UI: validate the composed screen, semantic
  typography/color/spacing tokens, information hierarchy, progressive disclosure levels,
  and mandatory visual self-review. Condensed from the upstream Nevo UI/UX guidelines;
  expands during dashboard migration.
related:
  - development.ui.react.component-guidelines
  - development.ui.tailwind.styling-guidelines
  - development.ui.storybook.guidelines
  - product.dashboard.interaction-model
---

# UI/UX engineering guidelines

`status: draft` — a condensed adaptation of the upstream Nevo UI/UX guidelines. The
principles are stable; concrete token tables and component specs are filled in as the
dashboard is migrated.

## Core design rules

- **Validate the composed screen, not the component in isolation.** A component that
  looks right in Storybook can still be wrong in the real screen. Check it in context.
- **Design around the user's questions.** Every surface answers a small set of "what do
  I need to know / do here" questions. Content that answers none of them is noise.
- **Visual weight is cumulative.** Borders, shadows, bold text, color, and spacing each
  add weight; too many "emphasized" elements means nothing is emphasized.
- **Design the host surface first.** Embedded content (a card, an inspector panel)
  respects the host's hierarchy — it does not compete with it.
- **Available space is not an information budget.** Fill space with breathing room, not
  with more data because it fits.

## Information hierarchy

Primary / secondary / tertiary must be visually distinguishable at a glance. Repetition
reduces emphasis — the tenth identical badge carries less signal than the first, so
compress repeated history semantically.

## Typography

Use **semantic typography tokens** (role-named: heading, body, label, metadata,
commentary), never raw font sizes scattered in components. Readability before density.
Commentary (prose the AI or system produces) is styled differently from metadata
(counts, timestamps, ids).

## Foreground and semantic color

- Neutral foundation; color carries **meaning**, not decoration.
- **Type uses shape; state uses color.** Don't encode a category purely as a color.
- A defined semantic status vocabulary (success / warning / error / info / running /
  neutral) maps to tone. Distinguish **tool failure** from **turn failure** — they are
  different states.
- "Waiting" is not "needs attention" — do not style a passive wait like an alert.

## Spacing and grouping

Use a small semantic spacing scale. Prefer grouping by whitespace and hierarchy before
reaching for borders and boxes.

## Progressive disclosure

Deeper levels increase **specificity**, not just volume. Define an information budget
per level (L1 summary → L2 expanded → L3 inspection list → L4 technical detail).
Hidden information must be **discoverable** (an obvious affordance to go deeper).
Do not promote inspection-only data (raw payloads, internal ids) up to L1/L2.

## Interaction hierarchy

One obvious primary interaction per surface. Icon semantics must be consistent and
learnable. A small icon still needs a comfortably large hit target.

## Loading and live state

Give immediate feedback on action. "Thinking" states need evidence (something is
actually happening). Distinguish historical/complete from live/in-progress.

## Responsive hierarchy

The hierarchy is the same across breakpoints; the density and which levels are inline
vs. behind a tap changes. Mobile reduces Work/inspection density, it does not drop the
primary answer.

## Mandatory visual verification

Before marking any UI task done:

1. Render every affected story/screen without a backend.
2. Run the component/interaction test suite.
3. Inspect desktop **and** mobile viewports.
4. When exact colors / spacing / animation matter, inspect **computed styles** on
   rendered DOM — do not claim visual correctness from class names alone.

## Anti-patterns

Raw font-size/color values in components; borders substituting for hierarchy;
promoting technical inspection data to the summary level; treating "fits on screen" as
"belongs on screen"; verifying UI from source instead of a rendered surface.
