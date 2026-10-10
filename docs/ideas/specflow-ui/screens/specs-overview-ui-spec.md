---
id: ideas.specflow-ui.screens.specs-overview
type: product
title: Specs Overview UI spec
status: draft
scope: specflow
areas: [ui]
tags: [specs, overview, attention, readiness, execution]
read_when:
  - implementing or reviewing the Specs overview
  - defining cross-Spec human steering
summary: >
  Vertical UI specification for the Specs collection: attention, readiness, current work,
  navigation, data/API requirements, component usage, visual rules, and responsive behavior.
related:
  - ideas.specflow-ui.screens
  - ideas.specflow-ui.spec-task-screen-structure
  - ideas.specflow-ui.information-navigation-inventory
  - product.specflow.ui.interaction-model
---

# Specs Overview UI spec

## 1. Purpose and ownership

Specs Overview is the human steering surface across Specifications.

It should answer:

1. What actually requires my intervention now?
2. What is ready if I choose to start/continue it?
3. What is currently being worked?
4. Which Specifications are still Draft?

"Requires attention" means progress is waiting on a human, not merely that an action exists.

The screen also owns the entry point for creating a new Specification.

It does not own Task evidence, Session transcript, or detailed workflow inspection.

## 2. User use cases

- Find a Specification with a human-required decision/interaction.
- Notice an active Session question/permission/confirmation that is waiting on me.
- Find ready work without confusing it with required attention.
- See current agent work, including batch execution, without inventing one representative Task.
- Open a Specification through one stable row target.
- Understand the aggregate reason for a Spec's queue position without exposing Task-level navigation in the list.
- Switch between Current and Archive collection views.
- Create a Specification with only a title, optionally add initial description, and optionally
  continue directly into agent initialization.

## 3. Entry and navigation

Global navigation -> Specs.

The entire Specification row opens the Specification. Its destination does not change because a
different issue becomes highest priority.

Status/reason prose inside the row is summary information, not a competing navigation target.
Task/Session-specific navigation appears after entering the Specification, where the responsible
context can be explained without fragmenting the overview row.

Opening a Specification is navigation only; no workflow mutation occurs.

## 4. Data source / read-model ownership

The overview should consume a backend/application projection designed for human steering.

Frontend may:

- render backend-supplied Current section IDs/order and map a rich projection to bounded rows;
- remember local filters/view selection;
- derive purely visual counts from returned items.

Frontend must not infer:

- requires-attention from raw statuses;
- per-action readiness from task lifecycle strings;
- current execution from historical Session associations;
- a representative Task for batch execution.

## 5. API availability / migration status

| Need                            | New SpecFlow | Old repo evidence                                                                           | Direction                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------ | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current/archive Spec collection | **missing**  | **old-repo-available** via `GET /api/dashboard`                                             | Preserve list identity/summary, replace legacy lifecycle ranking with new semantic steering projection.                                                                                                                                                                |
| Create Specification            | **missing**  | **old-repo-available** via `POST /api/specs`                                                | Preserve scaffolding capability, not the old request shape: target UX requires title only, derives slug internally, uses deterministic workflow unconditionally, allows optional initial description/goal, and may continue into the shared Session-start interaction. |
| Task summary/progress           | **missing**  | **old-repo-available** in `/api/dashboard` and `GET /api/specs/:source/:slug/task-statuses` | Preserve useful task metadata, but do not treat legacy `ready`/status as complete new readiness model.                                                                                                                                                                 |
| Human-attention projection      | **missing**  | partial/legacy workflow-action evidence                                                     | Add explicit server-owned attention signals.                                                                                                                                                                                                                           |
| Current single/batch execution  | **missing**  | partial Session/task association exists, but association is not authoritative execution     | Add explicit current execution projection.                                                                                                                                                                                                                             |
| Live invalidation               | **missing**  | **old-repo-available** via `GET /api/events` specs-changed SSE                              | Reuse event-driven invalidation concept; exact new transport may differ.                                                                                                                                                                                               |

The collection read now has a typed Runtime implementation at `GET /api/specs/overview`. Runtime
currently uses a sample `SpecsOverviewRepository` adapter behind the feature boundary so the UI can
exercise real HTTP, authentication and per-item `spec.view` filtering without making sample status
part of the public response contract. The missing production capabilities in the table refer to
persistent repository Specs/workflow data. See
[Specs Overview API](../../../reference/api/specs-overview.md) for the discriminated Current/Archive
source contracts and access semantics. Navigation is real: every Current/Archive row and its Open
specification menu action enters `/specs/:specId`, preserving the collection as parent return context.
This increment provides an explicitly labelled Specification placeholder, not document/Task/Session
details or a Specification read API. Creation and archive/delete mutations remain unavailable.

Creation and collection reads are separate application capabilities. Creating a Specification does not
require starting an agent Session; create-and-start composes Specification creation with the common
Session-start capability rather than inventing a separate AI transport.

## 6. Information hierarchy

Per Spec item:

1. identity/title — the row's primary target;
2. compact trailing metadata such as one linked PR and at most two tags;
3. one bounded secondary line with progress, one dominant aggregate state summary, and at most one
   materially useful concurrent qualifier.

The default backend-derived Current sections are, in order:

1. **Requires attention** (`requires-attention`): any actionable human-attention condition belonging
   to the Specification, a Task, Session, review, decision request, or blocker.
2. **Active** (`active`): authoritative current execution or Session activity without higher-priority
   human attention. This is not necessarily the Specification lifecycle status.
3. **Ready** (`ready`): approved/ready for work, with no execution and no human attention.
4. **Draft** (`draft`): still in preparation, before Ready.

Precedence is `requires-attention > active > ready > draft`. Each Current Specification has one
backend-owned `classification.section`; any authoritative human-attention signal wins even when
work is concurrent. A known `attentionReason` enriches the classification when available, but
absence of a known reason must not demote human-blocking work. Internal `working`, `quiet`,
`issue`, and similar signals are evidence, not top-level sections.

The backend supplies enabled section IDs in display order through the Current projection's
`sections` list. Project-owned `.nevo/config.yaml` may configure
`specs.overview.current.sections` as an ordered list of stable IDs. A configured list enables only
listed IDs. The frontend renders that order and maps stable IDs to its normal i18n keys. English
labels and generic rule expressions MUST NOT be put in YAML. Semantics remain backend-owned.

The current sample repository returns read records from which Runtime derives classifications. It is
not a production classification engine. Replacing it with persistent repository data must preserve
the same classification contract.

Do not duplicate one Spec across several Current sections. One dominant semantic section owns the
row. A lower-priority concurrent state may contribute at most one bounded, non-interactive qualifier
when omitting it would materially misrepresent what is happening; raw signal collections and Task IDs
remain outside the overview row.

Avoid miniature detail screens inside rows.

## 7. Pseudo-layout

```text
┌───────────────┬────────────────────────────────────────────────────────────┐
│ Nevo SpecFlow │ Specs                                      [+ New spec]    │
│               │ [ Current ] [ Archive ]                                    │
│ Specs         │                                                            │
│               │ ▾ ● Requires attention  2                                  │
│ Settings      │     Deterministic admission and execution boundaries        │
│               │     UI-1234   5 / 9 tasks   Owner decision required         │
│               │     Runtime authorization and project access policy         │
│               │     UI-1235   3 / 7 tasks   Agent input required            │
│               │                                                            │
│               │ ▾ ● Active  1                                              │
│               │     Provider diagnostics and replay               PR #31    │
│               │     RT-104    2 / 8 tasks   1 active session                │
│               │                                                            │
│               │ ▾ ○ Ready  1                                               │
│               │     Localization preferences                                │
│               │     UI-1236   0 / 5 tasks   Ready to start                  │
│               │ ▾ ○ Draft  1                                               │
│               │     Navigation cleanup                                      │
│               │     UI-1237   4 / 7 tasks   In preparation                  │
└───────────────┴────────────────────────────────────────────────────────────┘
```

The same Spec appears once in the canonical list. Rows are borderless/list-first. The outer list uses
the shared utility/marker/content scan columns from the steering contract. Current Specs Overview has
no Spec-selection checkbox or bulk action, so the row utility track remains empty while disclosure
uses it in section headers. The semantic marker occupies its own fixed column and does not move the
content axis.

## 8. Screen anatomy

- Workspace header: Specs.
- Screen and row action triggers use compact ellipses with accessible names, not visible labels.
  Opening replaces the visible ellipsis with a compact context heading in the same anchored surface:
  `Specs` for screen actions and the Spec key (or title fallback) for row actions. Items expand below
  that heading; there is no separate ellipsis above the expanded menu, generic `Actions` heading,
  or Close control. The surface sizes to its content and grows from the trigger footprint, without
  moving the underlying list. Outside click and Escape dismiss it and restore the ellipsis.
  Each action has an icon and text; the shared OverflowMenu owns reveal motion and reduced motion.
- Dominant attention summaries have one passive leading icon: conversation for input/decision,
  document inspection for review, warning only for explicit blockage. `attentionReason` is an
  optional semantic projection field, never inferred from label text. Unknown attention reasons
  use the conversation cue; agent-remediable issues use a quiet information cue.
- Header overflow includes Create session with a conversation-plus icon. The application owner
  supplies the common Session-start intent; without that capability the entry is disabled.
  This does not implement a private composer or fabricate a Session in presentation state.
- Collection control: Current / Archive.
- compact Search Specs control when the collection is large enough that scanning and section structure alone is
  insufficient; Archive should expect this earlier than Current because it grows monotonically.
- Backend-derived sections for Requires attention, Active, Ready, and Draft; each section uses the
  disclosure behavior defined by the Spec steering contract.
- Spec summary rows.
- Optional create-spec action only when product contract exists.

## 9. Responsive contract

Wide/Compact:

- same information hierarchy;
- global nav may be persistent or Drawer;
- overview remains one Primary surface.

Narrow:

- same section semantics and aggregate state summary;
- compact row text may move or reduce tertiary metadata;
- the whole Spec row remains the primary target;
- Task IDs/raw per-Task signals stay out of the canonical row;
- no critical aggregate state is hidden behind hover or secondary-only detail.

## 10. Interaction flows

### Specification row

Click/activate the row -> Specification.

The row's aggregate state summary is non-interactive prose. The user chooses the concrete Task,
Session, evidence, or action after entering the Specification.

A linked PR may remain a separate explicit nested target because it is a distinct external/contextual
resource rather than another interpretation of the row destination.

### Create Specification

Baseline:

```text
New specification
  title *                    required
  initial description       optional / collapsed by default

  slug / workflow mode      not user fields

[Create]
[Create and start with agent]
```

Create produces the empty Specification scaffold independently of agent initialization. The
application derives slug/technical
defaults; there is no Legacy/Deterministic choice.

Specification preparation currently has no deterministic workflow; deterministic Task execution
does not imply deterministic Specification preparation. See the
[owner lifecycle clarification](specification-workspace-ui-spec.md#owner-clarification-specification-lifecycle-and-extensibility)
for the current preparation path and future Specification-workflow boundary.

Create-and-start continues into the shared Session-start interaction (agent/provider selection as
needed, then normal composer/session experience). Do not maintain a separate rich prompt editor
inside the create dialog.

### Collection switch

Current/Archive changes collection state, not workflow state.

### Search

Search narrows the selected collection. Local filtering is fine for a bounded loaded set; server
search follows shared debounce/cancellation rules when needed.

The detailed Search × Current-section count × disclosure behavior is owned by
[Spec steering UI spec](../components/spec-steering-ui-spec.md#search-group-counts-and-disclosure).
In particular, a matching result must never remain hidden inside a previously collapsed section, and
section counts describe rows in the current filtered view rather than the unfiltered collection.

## 11. States

- loading: preserve header/filter geometry, restrained row skeletons;
- empty current: concise empty state with New specification action;
- archive empty: concise local empty state;
- requires attention: human intervention is actually required;
- active: actual ongoing agent/system work without stealing attention;
- ready: approved work without execution; draft: work still in preparation;
- partial signal failure: keep Spec identity/list usable and mark unavailable projection locally;
- stale/reconnecting transport: subtle connection feedback without rewriting canonical semantics.

## 12. Data loading, events, and Refresh

This screen inherits
[Data loading, refresh, batching, and eventing](../data-loading-refresh-and-eventing.md).

### Initial/live behavior

- fetch only the selected Current or Archive collection;
- relevant Spec change events invalidate/update affected collection items;
- do not fetch every Task document or every Session merely to render the overview;
- when many Spec-change events arrive in one filesystem/runtime burst, coalesce the resulting
  collection cache update rather than rendering once per raw event.

### Refresh

Expose one screen-level **Refresh** in the Specs header/overflow.

It refreshes only the currently displayed collection projection.

It does not automatically refresh:

- Task document bodies;
- Full Session histories;
- Settings;
- file/diff content.

Window-focus refetch and a slow safety refresh may be used as backstops. Avoid short polling when
relevant change events already invalidate the collection.

During refresh, retain the current list and show lightweight refreshing feedback.

The detailed row/section/aggregation contract is defined in
[Spec steering UI spec](../components/spec-steering-ui-spec.md).

## 13. Component / composition map

| Need                   | Component/composition                                                    |
| ---------------------- | ------------------------------------------------------------------------ |
| Shell/workspace        | AppShell + AppWorkspace                                                  |
| Header                 | WorkspaceHeader                                                          |
| Current/Archive        | Tabs or SegmentedControl after visual composition review                 |
| Sections               | product composition + Typography                                         |
| Rows                   | product-owned SpecSummaryItem using semantic list/button/link primitives |
| Status cue             | StatusIndicator/Badge sparingly                                          |
| Exceptional page error | Alert                                                                    |
| Loading                | Skeleton                                                                 |
| Empty                  | EmptyState                                                               |

Do not force the work queue into DataTable unless final content proves genuinely tabular.

## 14. Visual/token contract

- workspace: existing workspace surface;
- titles: \`text-content-primary\`;
- signal explanation: \`text-content-secondary\`;
- tertiary metadata: \`text-content-muted\`;
- row hover/focus: shared interaction tokens;
- dividers: \`border-divider\` / \`border-border-subtle\` only when whitespace is insufficient;
- attention: strongest semantic marker/tone according to actual meaning, not decorative color;
- Active: restrained running/activity marker;
- Ready: restrained success marker; Draft: neutral marker and preparation summary.

## 15. Local containment rules

- no Card per Spec row by default;
- no Card per section;
- no nested signal Cards;
- use rows, whitespace, headings, and dividers;
- a top-level exceptional outage/attention block may earn stronger containment;
- concurrent signals live inside the row hierarchy, not separate boxes for each signal.

## 16. Accessibility / focus

- the row has one clear accessible name and activation target;
- any explicitly allowed nested external/contextual control, such as a linked PR, has its own accessible name;
- section semantics cannot rely on color alone;
- focus after navigation follows product route/surface ownership.

## 17. Storybook scenarios

- rich concurrent source signals collapsing to one bounded row summary;
- Spec-level attention;
- active batch;
- Ready, distinct from Draft;
- Draft in preparation;
- long title and max trailing metadata;
- ultra-wide layout;
- Compact wrapping;
- Narrow layout;
- Current search with a matching previously-collapsed section;
- Current search with no matches;
- Current empty;
- Archive populated;
- Archive with many Specs + search.

## 18. Acceptance criteria

- requires-attention is reserved for human-blocking situations;
- default section order is Requires attention -> Active -> Ready -> Draft;
- these sections are backend-derived presentation categories, not Specification lifecycle statuses;
- a Spec appears once in the canonical Current queue;
- Current Specs use the sectioned steering presentation defined by the Spec steering contract;
- the entire row always opens Specification;
- summary/status prose inside the row is non-interactive;
- Task IDs and raw signal lists do not appear in the canonical row;
- section header and row content share one stable content axis beside a fixed gutter, and any section
  disclosure control follows the steering contract rather than acting as decorative iconography;
- current Specs Overview does not expose unsupported Spec-selection checkboxes or bulk actions;
- Search cannot hide matches inside collapsed sections and uses filtered section counts as defined by the
  steering contract;
- Archive uses bounded historical row semantics rather than Current steering state;
- aggregate summaries never invent a representative Task;
- batch remains batch-shaped;
- no current-work language is derived from historical Session association;
- New specification works with title only and does not require an initial prompt;
- create-and-start reuses the shared Session/composer path;
- repeated Specs are rows, not Card soup.

## 19. Open questions

- exact Current/Archive control;
- exact ordering/tie-break inside multiple simultaneous **attention** signals beyond the known rule
  that an active Session waiting on a human is high urgency;
- exact archive interaction;
- exact realtime transport in new Runtime.
