---
id: design-system.principles.ui-ux-guidelines
type: engineering
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
  mandatory visual self-review. Product-specific UX (AI sessions, SpecFlow UI screens) is
  under product/specflow/ui/.
related:
  - design-system.principles.information-hierarchy
  - design-system.principles.information-row-hierarchy
  - design-system.principles.layout-and-containment
  - design-system.implementation.react.component-guidelines
  - design-system.implementation.tailwind.styling-guidelines
  - design-system.implementation.storybook.guidelines
  - product.specflow.ui.interaction-model
---

# UI/UX engineering guidelines

`status: draft` — technology-agnostic guidance on building UI well. What a particular Nevo SpecFlow surface should _show and do_ — personas, screen contracts, AI-session behaviour
— lives under [`../../product/specflow/ui/`](../../product/specflow/ui/) and
[`../../product/specflow/cli/`](../../product/specflow/cli/).

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

The canonical semantic roles and default typography/emphasis mapping live in
`design-system.principles.information-hierarchy`.

Design the hierarchy from the user's **first scan**, not from the shape of the backend model, feature
folder, entity type, or available screen space.

Before composing a screen:

1. write down the small ordered set of questions the user should answer without opening deeper detail;
2. map the facts that answer those questions to the canonical structural/content/supporting roles;
3. keep the same role visually consistent across features, modals, lists, summaries, and detail views;
4. use semantic attention tone only when a fact changes interpretation/action now;
5. keep actions as actual interaction affordances rather than styled information text.

Do not use heading/label typography merely to make an ordinary value look important. A branch name,
Task title, Session title, Specification title, identifier, state, timestamp, or comment gets its
treatment from its semantic information role.

Semantic importance and permanent visual weight are not the same thing. A fact can be important to
the domain while still being quiet in the normal view. Conversely, an exceptional condition that
requires the user now may temporarily receive semantic emphasis without changing the underlying
information role.

Do not infer hierarchy from DTO field order, object nesting, the number of available fields, or a
generic dashboard convention. When product semantics do not establish the role, the decision belongs
to the owning product/UX contract rather than implementation.

## Stable composition and repeated structures

Repeated informational/operational items preserve the semantic roles from
`design-system.principles.information-hierarchy` and use the row-specific interaction rules from
`design-system.principles.information-row-hierarchy`.

Collection-level scan columns, utility gutters, grouped-list geometry, containment, and responsive
collapse are governed by `design-system.principles.layout-and-containment`.

Product UX owns which facts occupy those semantic slots. A different entity type is not, by itself, a
reason to invent a different visual grammar.

## Typography

Use the semantic information roles from `design-system.principles.information-hierarchy` for
ordinary structured product information. Do not select a different raw typography variant locally
when an established information role already owns that meaning.

Raw typography tokens remain available to design-system/component authors for genuinely new reusable
patterns, prose/document rendering, and cases explicitly outside the structured-information grammar.
Readability comes before density.

## Colour

- Neutral foundation; colour carries **meaning**, not decoration.
- **Type uses shape; state uses colour.** Do not encode a category purely as a colour.
- Map states to a small semantic vocabulary (e.g. success / warning / error / info /
  neutral) and to a consistent tone, rather than picking ad-hoc colours per component.

## Spacing and grouping

Use a small semantic spacing scale. Prefer grouping by whitespace and hierarchy before
reaching for borders and boxes.

Detailed Card, surface, nesting, row/list, and borderless-first rules live in
[Layout and containment guidelines](layout-and-containment.md).

## Established pattern discovery

Before inventing a new visual structure, identify the closest established product or design-system
pattern by **semantic responsibility**, not by markup similarity or component name.

For material regions and repeated structures:

1. inspect canonical design-system/product guidance;
2. inspect public component/pattern exports and representative stories/consumers when useful;
3. reuse the established pattern when it satisfies the intended semantics and interaction;
4. prefer composition over an existing pattern before adding another primitive;
5. extend the reusable owner when the missing capability is itself reusable;
6. create a product-local custom structure only when established patterns cannot satisfy a material
   semantic/interaction requirement.

A missing reference in a UX spec is not permission to skip discovery.

When UX intentionally departs from an established pattern, the product contract should state the
user-facing reason. Implementation file paths are not durable pattern references.

## Progressive disclosure

The authoritative contract for reading continuity, first-scan mapping, reachable complete values,
and acceptance evidence is
[Reading continuity and reachable detail](information-hierarchy.md#reading-continuity-and-reachable-detail).
Apply it to the composed screen and its expanded states, not only individual rows.

Deeper levels increase **specificity**, not just volume. Give each level an information
budget and keep to it. Hidden detail must be **discoverable** — an obvious affordance to
go deeper. Do not promote inspection-only data (raw payloads, internal ids) to a
summary level. (The specific level model for SpecFlow UI's AI Work view is in
[`product/specflow/ui/ai-session-ux.md`](../../product/specflow/ui/ai-session-ux.md).)

## Interaction hierarchy

One obvious primary interaction per surface. Icon semantics must be consistent and
learnable. A small icon still needs a comfortably large hit target.

For surface-level actions, prefer one visible primary action when the header has useful space and move
secondary actions into overflow. Constrained headers may move all actions into overflow rather than
compressing the title or creating several equally strong buttons.

Selection should normally change **action emphasis, not layout geometry**. If a collection reserves a
selection gutter or an action region, keep those anchors stable while selection changes which actions
are enabled or promoted. A selected-count label may remain absent at zero and appear only when it
communicates useful state.

A decision action may appear both as a convenient surface/header action and again at the natural end
of a deliberate evidence-reading flow when both affordances invoke the same authoritative command
and share pending/disabled state. Do not duplicate ordinary actions merely to fill space.

## Loading and live state

Give immediate feedback on an action. A "busy" indicator is shown only when something is
actually in progress, not as decoration. Distinguish a **settled** view from one that is
**still updating**.

## Responsive hierarchy

The hierarchy is the same across breakpoints; what changes is density and whether a
level is inline or behind a tap. Reducing density on small screens must not drop the
primary answer.

## Mandatory visual verification

Rendered inspection is part of the definition of done for UI work. Passing tests and correct source
code are not evidence that a composed screen looks correct.

Before marking any UI task done:

1. Render every affected story/screen without a backend where deterministic fixtures can represent
   the state.
2. Run the relevant component, interaction, and accessibility tests.
3. Inspect every responsive layout mode affected by the change. At minimum check:
   - a representative desktop / Wide viewport;
   - a Compact viewport around the relevant workspace breakpoint when the surface participates in
     responsive workspace composition;
   - mobile at approximately 375 px;
   - approximately 320 px when controls, labels, metadata, or multi-column content make overflow
     plausible.
4. Use realistic fixtures, including long titles/labels and dense/repeated content where those cases
   are possible. Conveniently short placeholder text is not sufficient visual coverage. For repeated
   operational collections, include at least one stress fixture that mixes very short rows with
   intentionally extreme but valid keys, titles, counts, summaries, and trailing metadata. Verify
   that the collection remains vertically scannable rather than merely avoiding overflow.
5. Inspect the composed application, not only an isolated Storybook story, when correctness depends
   on App Shell / AppWorkspace composition, viewport height, scrolling, routing, sticky/fixed
   regions, or Primary/Secondary behavior.
6. When exact colours, spacing, dimensions, overflow, or animation matter, inspect **computed
   styles** and rendered element dimensions. Do not claim visual correctness from class names alone.
7. Record the intended first scan and exercise the explicit detail paths. Inspect collapsed and
   expanded content together: the object remains identifiable, added detail does not restart its
   identity, and long technical references do not displace the primary answer. Include widths
   around content wrap/truncation thresholds, not only the smallest and largest viewport.

During each rendered pass actively check:

- **spacing and containment** — no accidental double padding, unexplained empty regions, overly
  dense groups, inconsistent rhythm, unnecessary nested surfaces, or large unused areas caused by a
  layout that merely technically fits;
- **viewport use** — surfaces that are intended to fill the available application height do so, and
  content does not stop at intrinsic height or become vertically clipped by mistake;
- **overflow and text resilience** — no horizontal page overflow, clipped text, controls whose
  labels escape their bounds, badges/metadata leaving containers, flex/grid children widening the
  viewport, or destructive wrapping under realistic long content;
- **responsive hierarchy** — Wide, Compact, and Narrow preserve the same primary answer and required
  actions; Narrow does not retain desktop-only assumptions, and Back/Close affordances remain
  available where the interaction model requires them;
- **visual hierarchy** — primary content and actions are obvious, secondary actions are quieter,
  metadata is distinguishable from narrative content, and repeated status/borders/cards/colour do
  not add visual noise;
- **important states** — inspect the meaningful states defined by the owning screen/component
  contract, including loading, empty, unavailable/error, dense content, and exceptional attention
  states when applicable.

Visual review is iterative: **implement -> render -> inspect -> fix -> render again**. Fix visual
problems that are reasonably within the task instead of only documenting them. The final rendered
inspection must happen after the last UI/CSS change.

When reporting verification, name the rendered surfaces and the actual viewport widths inspected
rather than saying only that "desktop and mobile were checked".

## Anti-patterns

Raw font-size/colour values in components; borders substituting for hierarchy; promoting
technical inspection data to the summary level; treating "fits on screen" as "belongs on
screen"; state-specific bespoke row geometry; arbitrary fixed column splits for optional metadata;
premature wrapping that leaves useful width empty; verifying UI from source instead of a rendered
surface.
