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
  Portable engineering rules for building UI: validate the composed screen, semantic
  typography/color/spacing tokens, information hierarchy, progressive disclosure, and
  mandatory visual self-review. Product-specific UX (AI sessions, dashboard screens) is
  under product/dashboard/.
related:
  - development.ui.react.component-guidelines
  - development.ui.tailwind.styling-guidelines
  - development.ui.storybook.guidelines
  - product.dashboard.interaction-model
---

# UI/UX engineering guidelines

`status: draft` — a condensed, **technology-agnostic** adaptation of the upstream Nevo
UI/UX guidelines. It says how to build UI well in general. What a particular Nevo
SpecDev surface should _show and do_ — personas, screen contracts, AI-session behaviour
— lives under [`../../product/dashboard/`](../../product/dashboard/) and
[`../../product/cli/`](../../product/cli/).

## Core design rules

- **Validate the composed screen, not the component in isolation.** A component that
  looks right in Storybook can still be wrong in the real screen. Check it in context.
- **Design around the user's questions.** Every surface answers a small set of "what do
  I need to know / do here" questions. Content that answers none of them is noise.
- **Visual weight is cumulative.** Borders, shadows, bold text, colour, and spacing each
  add weight; if everything is emphasised, nothing is.
- **Design the host surface first.** Embedded content (a card, an inspector panel)
  respects the host's hierarchy — it does not compete with it.
- **Available space is not an information budget.** Fill space with breathing room, not
  with more data because it fits.

## Information hierarchy

Primary / secondary / tertiary must be distinguishable at a glance. Repetition reduces
emphasis — the tenth identical badge carries less signal than the first, so compress
repeated content rather than repeating a heavy treatment.

## Typography

Use **semantic typography tokens** (role-named: heading, body, label, metadata,
narrative), never raw font sizes scattered through components. Readability before
density. Narrative prose and dense metadata (counts, timestamps, ids) get visibly
different treatments.

## Colour

- Neutral foundation; colour carries **meaning**, not decoration.
- **Type uses shape; state uses colour.** Do not encode a category purely as a colour.
- Map states to a small semantic vocabulary (e.g. success / warning / error / info /
  neutral) and to a consistent tone, rather than picking ad-hoc colours per component.

## Spacing and grouping

Use a small semantic spacing scale. Prefer grouping by whitespace and hierarchy before
reaching for borders and boxes.

## Progressive disclosure

Deeper levels increase **specificity**, not just volume. Give each level an information
budget and keep to it. Hidden detail must be **discoverable** — an obvious affordance to
go deeper. Do not promote inspection-only data (raw payloads, internal ids) to a
summary level. (The specific level model for the dashboard's AI Work view is in
[`product/dashboard/ai-session-ux.md`](../../product/dashboard/ai-session-ux.md).)

## Interaction hierarchy

One obvious primary interaction per surface. Icon semantics must be consistent and
learnable. A small icon still needs a comfortably large hit target.

## Loading and live state

Give immediate feedback on an action. A "busy" indicator is shown only when something is
actually in progress, not as decoration. Distinguish a **settled** view from one that is
**still updating**.

## Responsive hierarchy

The hierarchy is the same across breakpoints; what changes is density and whether a
level is inline or behind a tap. Reducing density on small screens must not drop the
primary answer.

## Mandatory visual verification

Before marking any UI task done:

1. Render every affected story/screen without a backend.
2. Run the component/interaction test suite.
3. Inspect desktop **and** mobile viewports.
4. When exact colours / spacing / animation matter, inspect **computed styles** on
   rendered DOM — do not claim visual correctness from class names alone.

## Anti-patterns

Raw font-size/colour values in components; borders substituting for hierarchy; promoting
technical inspection data to the summary level; treating "fits on screen" as "belongs on
screen"; verifying UI from source instead of a rendered surface.
