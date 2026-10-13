---
id: design-system.principles.information-hierarchy
type: engineering
title: Semantic information hierarchy
status: current
scope: nevo-ui
areas:
  - ui
tags:
  - hierarchy
  - typography
  - semantics
  - information
  - actions
read_when:
  - designing or implementing any product UI that presents structured information
  - deciding how a fact should be emphasized or which typography role it should use
  - reviewing typography consistency across different entities or surfaces
summary: >
  Canonical semantic roles for ordinary structured product information and their default
  typography/emphasis treatment. Roles follow semantic responsibility in context rather than entity
  type, while component-owned and specialized typography contracts remain authoritative for the
  structures they own.
related:
  - design-system.principles.ui-ux-guidelines
  - design-system.principles.information-row-hierarchy
  - design-system.principles.layout-and-containment
  - design-system.principles.system-boundary
---

# Semantic information hierarchy

## Purpose

Product information should look consistent because it has the same **semantic role**, not because it
belongs to the same entity type or feature.

The core rule is:

> **Information role determines visual hierarchy. Entity type does not.**

A Specification title, Task title, Session title, branch name, file name, integration name, or other
value may describe different domain objects. If each has the same semantic responsibility in a
comparable context — for example answering **what is this?** — it uses the same primary-information
treatment unless an owning design-system/product contract explicitly establishes a different role.

The same domain fact may legitimately take a different role in another context when it answers a
different user question. A branch name can be primary in a Repository summary and secondary in a PR
surface; a timestamp can be ordinary metadata in one view and supporting information in a flow where
freshness materially affects the user's decision.

This document owns semantic information roles and their default typography/emphasis mapping for
**ordinary structured product information**.

It does not replace component-owned typography contracts or specialized structural patterns.
Existing design-system components and patterns remain authoritative for typography they explicitly
own, such as navigation item labels, workspace/page titles, document/prose
rendering, or other specialized structures.

Geometry, tracks, spacing, containment, and responsive placement are owned by
`design-system.principles.layout-and-containment`.

## Structural roles

Structural labels name a region of ordinary product content. They are not ordinary product values.

These default structural roles do not supersede specialized component-owned labels. If an
established navigation, menu, workspace-header, page-title, or other reusable
component owns its typography contract, use that contract rather than remapping it through the
generic roles below.

### Section title

A section title names a meaningful region such as Repository, Tasks, Sessions, Activity history, or
a comparable product section.

Default treatment:

- semantic role: section title;
- typography: `section-label`;
- emphasis: primary content colour;
- uppercase treatment: provided canonical by `section-label` (12px, 16px line height, semibold, uppercase, 0.12em letter spacing);
- use a real heading element when it participates in the document/accessibility outline.

Do not use section-title styling for a branch, Task, Session, identifier, state, or other value
merely because that value is important.

### Group label

A group label names a subgroup inside a collection, such as a Task group or state group.

Default treatment:

- semantic role: group label;
- typography: `label-sm`;
- emphasis: primary content colour;
- counts or compact group metadata remain secondary to the label.

A group label describes the collection structure. It is not the primary information of an individual
item.

## Content roles

### Primary information

Primary information answers **what is this item/object/value the user is currently scanning?**

Typical examples:

- Specification title;
- Task title;
- Session title;
- branch name in a Repository summary;
- pull-request title;
- file/document name.

Default treatment:

- typography: `title-sm`;
- emphasis: primary content colour.

Primary is a semantic role, not a request for a larger heading. A screen may contain many primary
values in rows or summaries.

### Secondary information

Secondary information answers **what concise context helps identify or compare this primary value?**

Typical examples:

- stable key or compact identifier;
- progress/count;
- base branch;
- time;
- owner;
- compact lifecycle/classification;
- relationship metadata.

Default treatment:

- typography: `body-sm`;
- emphasis: muted content colour.

Secondary information remains visually quieter than primary information even when it is
operationally important.

### Supporting information

Supporting information answers **what additional fact helps interpret the current primary value or
decide what to do next?**

Typical examples:

- current activity;
- dependency/waiting context;
- concise explanatory state;
- a longer status/comment that needs more room than compact comparison metadata.

Default treatment:

- typography: `body-sm`;
- emphasis: secondary content colour.

Supporting information may be longer or more fluid than secondary metadata, but length does not make
it a heading.

### Semantic supporting information

Semantic supporting information is supporting information that needs a stable semantic tone because
it materially changes interpretation or action.

Typical examples:

- requires decision;
- blocked/unavailable reason;
- warning-worthy repository condition;
- active/running state when that state materially matters in the current surface.

Default treatment:

- typography: `body-sm`;
- emphasis: the applicable semantic tone;
- optional semantic icon when the icon has an established meaning.

Semantic colour/icon changes the tone of supporting information. It does not promote the text to a
heading or create a new typography hierarchy.

## Actions are not information roles

Navigation and commands are interaction affordances, not styled information.

Use the established Link, Button, IconButton, Menu, or owning action pattern for actions such as:

- Open session;
- All sessions;
- New conversation;
- PR review;
- Changes.

Do not make an action look like ordinary bold text and do not append decorative arrows to imply
clickability when the design system already owns link/button affordance.

The action's placement is owned by the surrounding layout/pattern. Its interaction treatment is
owned by the appropriate design-system component.

## Semantic role versus HTML semantics

Visual information role and semantic HTML are related but not identical.

An item title may need an `h2` or `h3` element for document structure while still using the
primary-information typography treatment. Conversely, a non-heading value must not receive heading
typography merely to make it look important.

Choose HTML semantics for accessibility/document structure and the information role for visual
hierarchy.

## Role stability

Within a surface and across comparable product surfaces:

- the same **semantic responsibility** keeps the same role across comparable contexts;
- the same domain fact MAY take a different role when it answers a different user question or serves
  a different responsibility in that context;
- a role does not change merely because one entity type uses a different component;
- a state change does not arbitrarily promote secondary information to primary;
- responsive layout may move a fact, but it does not change its role within the same user task;
- a modal does not invent a new typography hierarchy for responsibilities that already have
  established roles;
- missing optional information removes that fact; it does not cause neighboring facts to assume a
  different semantic role accidentally.

When a fact changes role between contexts, the distinction should be explainable in user-task terms,
not by feature ownership or implementation convenience.

## Mapping product facts

Before composing or implementing a material region, map its facts to semantic roles.

Example shape:

```text
Repository
  section title          -> Repository
  primary                -> feature/session-refresh
  secondary              -> base main
  semantic supporting    -> 4 uncommitted files
  secondary              -> 1 commit behind upstream
  secondary              -> no local conflicts

Session summary
  primary                -> session title
  secondary              -> task count
  secondary              -> age
  supporting             -> current activity
  action                 -> Open session
```

The examples illustrate role assignment, not a required layout.

## Reading continuity and reachable detail

**A surface MUST preserve a readable path through the user's task; expanding detail MUST increase
specificity without making the user reconstruct the object's identity and hierarchy.**

This is a composed-surface requirement. Correct typography tokens, complete DTO rendering, no
overflow, and passing automated tests do not by themselves establish readable hierarchy.

### Establish the first scan

Before implementing a new screen or materially changing a region, the owning UX contract MUST state:

- the ordered questions answered on the first scan, such as object identity, relevant state,
  consequence/reason, and available next action, where those questions apply to the user task;
- which facts answer those questions and which are inspection-only detail;
- the visible owner of each action;
- the explicit entry and return path for each group of information placed deeper.

Use a short mapping in the existing handoff; a local spacing correction does not require a new
screen specification. No universal field count or fixed number of levels substitutes for this mapping.
The order follows the actual task, not a mandatory template for every screen.

### Preserve the reading anchor

The item's identity is the reading anchor. Inline detail MUST remain visibly subordinate to that
item and MUST NOT restart the same item with a duplicate title and unchanged identity metadata
merely to introduce an expanded region. A separately navigated surface or a context-preserving
sticky header may repeat identity when it is needed to orient the user.

Comparable sibling items MUST preserve the same semantic reading order. Group purpose, state,
materials, and actions by the questions they answer; do not interleave them with unrelated technical
keys or provenance because those fields happen to be adjacent in the read model. Concrete alignment,
spacing, and scan geometry remain owned by `design-system.principles.layout-and-containment`.

### Make depth useful

Information MUST be reachable, but need not all be permanently expanded. A disclosure MUST have a
visible, meaningful opener belonging to the object it explains, keyboard access, and a defined
collapse/return behavior that preserves context. Required decision evidence, an actionable blocker,
or an access failure MUST NOT be moved behind generic technical detail when it changes what the
user can understand or do on the current surface.

Technical identifiers, memberships, and provenance SHOULD be grouped under an explicitly named
inspection entry when they do not answer a first-scan question. A raw reference MUST NOT become a
dominant multi-line title solely to avoid truncation. Use a truthful readable identity where one
exists, enough context to distinguish collisions, and explicit access to the complete value.
Do not invent a resolved title, target, or reader for an opaque reference.

If a complete value is shortened, the UI MUST provide an explicit way to read the full value using
keyboard and touch; hover-only disclosure or silent ellipsis is insufficient. The full reference
MUST remain selectable or copyable. An unavailable resource reader and an unavailable reference
value are different conditions and MUST NOT be conflated.

Repeated source limitations SHOULD be explained at their shared owner, with each affected item's
state still clear. Distinct item failures MUST remain distinguishable. Known empty optional regions
SHOULD disappear; an unavailable source MUST NOT be represented as a known empty region.

### Acceptance evidence

A material UI handoff MUST identify the first scan, the disclosure paths, and the composed renders
used to verify them. Review MUST check the collapsed and expanded states with both ordinary and
long/dense content, including a width where text changes from wrapping to truncation or columns.
Verify the actual panel width as well as the window width.

The review MUST reject a composed surface when technical content overwhelms the intended primary
answer, inline expansion restarts the same context, a complete value becomes unreachable, or
responsive changes lose the reading order or action owner. A clean axe/overflow report does not
waive these checks. UI verification procedure remains in
`design-system.principles.ui-ux-guidelines`.

## When a new role is justified

Do not create feature-specific typography roles such as `task-title`, `session-metadata`, or
`repository-value` when an existing semantic role already describes the information.

A new reusable role is justified only when existing roles cannot express a materially different
information responsibility across multiple contexts. Add it at the design-system owner and document
how it differs semantically, rather than introducing local font-weight/size conventions.

## Review checklist

Before accepting a composed surface, verify:

1. Does every material fact have an understandable semantic responsibility in this context?
2. Do values with the same responsibility use the same role across comparable contexts?
3. If the same domain fact changes role, is that because it answers a different user question?
4. Is ordinary metadata kept secondary unless the current user task gives it a different
   responsibility?
5. Is longer explanatory state supporting information rather than a local heading?
6. Does semantic warning/success/info treatment change tone without changing information hierarchy?
7. Are actions rendered through actual action/navigation patterns instead of styled text?
8. Does an established component/pattern already own the typography instead of this generic mapping?
9. Have local raw typography choices created a role that the design system already owns?
