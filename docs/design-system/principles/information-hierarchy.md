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
