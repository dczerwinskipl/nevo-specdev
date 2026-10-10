---
id: ideas.specflow-ui.screens.specification-workspace
type: product
title: Specification UI spec
status: draft
scope: specflow
areas: [ui, workflow]
tags: [specification, workspace, tasks, workflow, evidence]
read_when:
  - implementing or reviewing a Specification surface
  - designing Spec-level steering and Task collection behavior
summary: >
  Vertical UI specification for one Specification surface: workflow meaning, high-priority
  signals, Task collection, evidence, navigation, API/read-model requirements and responsive behavior.
related:
  - ideas.specflow-ui.screens
  - ideas.specflow-ui.spec-task-information-hierarchy
  - ideas.specflow-ui.spec-task-screen-structure
  - product.specflow.ui.interaction-model
---

# Specification UI spec

The complete composition/navigation draft is currently kept in the ignored local planning area.
It combines the owner clarifications below with a rendered navigation comparison. This ideas document remains discovery
and migration evidence; earlier Secondary-only document/Session sketches are not final navigation
requirements.

## 1. Purpose and ownership

The Specification surface is the main working context for one Specification.

The current working direction is to let the user quickly:

1. remember what the Specification is about;
2. notice anything that requires human attention now;
3. resume one relevant recent Session when work has already started;
4. see what Task work remains and select Tasks for the next Session;
5. inspect deeper Task, Session, evidence, and history context without losing the Specification.

It owns:

- Spec identity and intent;
- Spec-level workflow meaning/actions;
- cross-object human-attention summary when one is needed;
- one bounded recent/relevant Session entry point plus access to Session history;
- Task collection and selection;
- supporting Spec-level evidence/history;
- contextual entry into Task detail and related Sessions.
- discoverable access to the configured Specification document collection;
- relevant repository/worktree/change context and capability-provided sections when available.

It does not flatten Task detail, Session transcript, review evidence, change inspection, or raw workflow
internals into the Primary.

This document remains a draft under `docs/ideas/**`. It records the current product/UX direction and
open questions that should be exercised with the hardened UX Designer before promotion into
authoritative product documentation.

## 2. User use cases

### Owner clarification: Specification lifecycle and extensibility

The owner clarified the following product direction during UX discovery on 2026-10-07.
These decisions refine the draft inputs; they do not claim that the current SpecFlow placeholder
implements the old product's capabilities.

- Creation establishes the Specification and its empty scaffold independently of an agent Session.
  The owner may populate prepared content manually. An optional initialization-with-agent choice
  starts a Session that fills the files; the agent does not own Specification creation.
- Specification preparation currently has no deterministic workflow. Tasks emerge while the agent
  refines/extends the Specification, followed by review. No manual Add Task control is required for
  this design scope.
- Once Tasks have passed review and left Draft, the owner can start their deterministic work.
  Task workflow and Specification preparation are separate concerns.
- A new Specification-related Session remains possible during execution. Refinement can add Tasks
  after earlier work has started; do not treat a prepared Specification as a frozen Task set.
- The screen design covers empty/preparing Specifications as well as prepared and executing ones.
  An absent Task collection must not make Specification content and Session entry unreachable.
- A future iteration will add deterministic Specification workflow. Its steps, statuses, and
  actions are unresolved. Do not invent a current Refine/Progress/Deploy command or stepper.

### Owner clarification: Task grouping

Task groups are configured by the user/project and supplied by the backend in display order with
their Task members. User-defined workflow statuses may map several statuses to one group. Group
identity is stable independently of individual status changes; membership may change as work moves.

Do not prescribe Overview's Requires attention / Active / Ready / Draft taxonomy for Tasks, or
replace configured groups with a fixed implementation-plan ordering. The backend owns semantic
membership and mapping; the frontend renders the returned grouping rather than classifying raw
status strings. Exact configuration and transport schemas remain deferred.

Requires attention is a separate cross-object priority region, not one of those Task groups. It
can point to a Task, Session, or relevant CI/deployment condition when authoritative facts actually
require the human. These operational integrations are future scope, not fabricated current data.

### Owner clarification: Session intents and future Specification operations

Distinguish these user intents even when they reuse the shared Session-start interaction:

- Execute with agent for selected Tasks: validate the complete selected set and create a
  Task-associated Session with that scope. Exact action wording remains a UX design decision.
- Discuss/refine this Specification: start a Specification-associated Session without requiring
  Task selection. This remains useful before Tasks exist and during later scope expansion.
- Future Specification-workflow execution: start or continue the formal Specification steps once
  that capability exists. Step names, transitions and readiness are not defined by this screen.

Every Session belongs to a Specification in the current product scope. "Independent" conversation
means no Task execution binding, not absence of Specification ownership. The Session list therefore
belongs to the Specification's contextual detail; no global Sessions navigation is needed. It is a
collection of conversations, including active and settled ones, rather than only completed history.
The existing bounded recent-Session target remains the main-screen resume proposal.

Execution context can change within the same Session. See
[Session association vs current execution](../../../product/specflow/ui/ai-session-ux.md#session-association-vs-current-execution)
for the owning shared UX guidance. Do not add a permanent Session-type picker to this screen.

Specification-wide deployment may eventually be a Task or a Specification workflow step driven by
an agent/automation. The owner explicitly left this choice open. Design future action ownership
around the operation's scope and evidence, without selecting its workflow representation now.

### Use-case inventory

- Understand what change the Specification represents.
- Read a concise Specification description without forcing the full body into the initial layout.
- Notice human-required attention before normal Session/Task work.
- Resume the most relevant recent Session without turning the main surface into Session history.
- Reach older/relevant Sessions deliberately when needed.
- See which Tasks remain relevant for work and inspect their current meaning.
- Select one or several Tasks and invoke legal bulk actions such as Start.
- Preserve dependency/readiness warnings for the selected Task set.
- Open a Task without abandoning the Specification.
- Inspect readable supporting documents/evidence.
- Start a new Session when needed using the shared Session-start interaction.
- Follow relevant links to project-level changes/PRs/deployment/release facts when those capabilities
  exist.

### Scope correction: documents and plugin-contributed sections

The owner explicitly clarified that the screen's scope is broader than Tasks and Sessions. The
first-scan direction above is a candidate for the main work view, not a complete information
architecture for everything owned by or related to a Specification.

Specification documents are a configurable collection returned by the backend, not one fixed
Specification Markdown body. The configured files may include the main Specification, area
documents, architecture drafts, and future Markdown resources. The frontend must not enumerate
business document kinds or reconstruct this manifest from filenames. File reading needs a
discoverable collection and comfortable full-workspace reading; it is not satisfied by a More
disclosure on the description or by placing every document below the Task list.

Enabled product plugins/capabilities may contribute relevant sections. Git/worktree is a baseline
example. CI/CD, release and deployment are future examples for extensibility validation, not requests
to design those operational products now. This concerns SpecFlow product plugins, not Codex plugins.

Latest owner scope: widget-specific contents/data are deferred; Git remains an illustrative fixture.
The proposed backend-ordered section manifest is recorded in that local screen draft,
not this discovery sketch. Backend presence/order must not be reconstructed from hard-coded plugin
names or frontend severity sorting.

The existing shared navigation keeps global product areas small. Whether Specification-local
sections become dedicated main-workspace destinations rather than only contextual inspectors is
now a material design question. Do not freeze the earlier Secondary-only Session/document proposal
before exercising the complete collection/navigation model.

### Discovery inventory and candidate placement

This matrix records a recommendation to compare, not an approved layout or plugin API.

| User need                       | Main work view candidate                                                | Deliberate deeper destination                                     | Availability/ownership                                                                 |
| ------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Understand the change           | Title and bounded description                                           | Main Specification document                                       | Core; description is not the whole document manifest                                   |
| Find prepared context           | Discoverable Documents entry, optional bounded references when relevant | Configured document collection and comfortable Markdown reading   | Backend supplies manifest/order; no hard-coded Areas/Architecture tabs                 |
| Choose/inspect Task work        | Configured grouped Task collection and selection actions                | Task Secondary/local evidence stack                               | Core; backend supplies group semantics                                                 |
| Resume or start a conversation  | One relevant Session target and conversation entry                      | All Sessions belonging to this Specification                      | Core; exact collection surface still under review                                      |
| Understand repository/worktree  | Compact current context when it affects orientation or next work        | Repository/worktree detail                                        | Enabled capability; identify whether context is Spec-specific or shared                |
| Review changes                  | Bounded change summary/link when useful                                 | Changes collection and diff inspection                            | Git/source integration capability; no Git means no fabricated Git destination          |
| Reach a PR/MR                   | Concise related reference when useful                                   | Explicit linked PR/MR source/detail                               | Available integration; provider is source metadata                                     |
| See CI/deployment/release facts | Optional relevant summary; human-required item in Requires attention    | Capability's contextual section or owning operational surface     | Future enabled capability; do not assume project facts belong exclusively to this Spec |
| Review evidence/history         | Decision-relevant references                                            | Evidence from its owning decision; broader history when requested | Do not reduce all evidence to one unstructured Attachments bucket                      |

Changes inspection must distinguish uncommitted work from comparison to the configured base branch
(often main) and from linked PR/MR changes. These may overlap: do not add their counts as though they
were disjoint or silently call all current worktree changes this Specification's changes. Exact
attribution remains a capability/read-model question.

### Specification-local navigation model (Owner decision)

The owner decision settles **Specification-local contextual navigation** for the Specification Workspace:

- **Decided model**: Specification-local contextual navigation. On Wide, it provides discoverable Specification-local navigation without a horizontal tab strip and without an extra permanent width-consuming rail; on Compact/Narrow, it collapses into a contextual view selector.
- **Historical alternative (rejected)**: Specification-local horizontal tabs / SegmentedControl strip. Rejected because:
  - the number of local destinations can grow and capability/plugin sections may appear;
  - labels can be long or dynamic;
  - horizontal tabs scale poorly on Compact/Narrow and horizontal overflow can hide important destinations;
  - local navigation must remain clearly subordinate to global product navigation;
  - a permanent third rail inside the workspace would consume vital content width.

Quick Task/evidence inspection uses Secondary; extended document reading or Changes inspection uses its dedicated local view. Do not introduce a third simultaneous workspace content pane.

### Candidate contribution rules to validate

- Summary and destination are separate contribution needs. A capability may justify one or both;
  enabled plugins do not automatically earn a permanent main-screen widget.
- A normal main-view summary should explain a relevant current fact or next step and link to its
  detail. A plugin-supplied human-required condition belongs in cross-object Requires attention
  with its real owner/target, not a duplicate alert per widget.
- A section earns a local destination when the user has an independent inspection/work task there,
  such as reading documents or comparing changed files. A short supporting fact can stay inline.
- Core identity, attention, Session and Task hierarchy must remain recognizable as sections are
  added. Do not permit unbounded plugin insertion ahead of the main first-scan answers.
- No plugin-specific visual language or Card-per-plugin treatment follows merely from extensibility.
- Distinguish a capability that is absent/disabled from an enabled contribution that failed to load;
  failure must not erase the user's current work view or unrelated core content.
- Plugin identifiers, contribution schemas, rendering mechanism and action protocols are deferred.
  Settings catalog extensibility is evidence, not an already-defined Specification UI plugin API.

### Expanded composition validation

Compare the candidate navigation with: no Git; Git/worktree only; several configured documents;
many/long document labels; many Sessions; uncommitted plus base-branch plus PR/MR change sources;
several future capability sections; a failed enabled contribution; and a Task inspector open.
Include preparing and executing Specifications on Wide, Compact and Narrow, and verify that users
can find Documents and the owning context of Changes without scrolling through unrelated Tasks.

## 3. Entry and navigation

Entry:

- Specs Overview canonical Spec row;
- direct/deep link to Specification;
- normal router Back from Full Session may return to this Specification; previously open Task
  Secondary is local state and is not reconstructed from the URL.

Wide/Compact:

- Specification = Primary;
- selected Task and other contextual detail may use Secondary.

Narrow:

- Specification = visible surface;
- selecting Task or another contextual target pushes detail;
- Back returns to Specification preserving selection/scroll where possible.

Opening Task, Session, document, or evidence context is navigation only. It must not implicitly start
workflow work or make a human decision.

## 4. Data source / read-model ownership

Backend/application owns:

- Spec identity/document inventory;
- Spec-level workflow projection;
- authoritative human-attention semantics;
- Task summaries and semantic signals;
- configured Task group identities/display order and their members;
- current single/batch execution projections;
- action readiness/reasons;
- relevant evidence/artifact references;
- related Session summaries and the facts needed to choose/present a relevant recent Session.

Frontend may compose those projections and reduce them into bounded presentation models, but
must not reconstruct workflow or Session semantics from arbitrary status strings, DTO shape,
repository files, or historical association.

In particular, frontend must not:

- infer human attention from arbitrary error/status text;
- invent Session roles such as Implementer/Reviewer when the read model does not provide them;
- infer current execution from historical Task association;
- render every Task association merely because it exists;
- decide legal multi-Task start by looping over individual Task `ready` flags.

## 5. API availability / migration status

| Need                                                | New SpecFlow | Old repo evidence                                                                          | Direction                                                                                                                                                                           |
| --------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Specification summary/tasks                         | **missing**  | **old-repo-available** in `GET /api/dashboard`                                             | Preserve identity/task metadata, replace old lifecycle assumptions with new read model.                                                                                             |
| Document manifest/body                              | **missing**  | **old-repo-available** via `GET /api/specs/:source/:slug/content` and `.../content/:docId` | Strong migration candidate; use stable Spec identity in new contract.                                                                                                               |
| Task status/dependencies                            | **missing**  | **old-repo-available** via `.../task-statuses`                                             | Preserve dependency facts, replace universal ready/block semantics with per-action semantic projection.                                                                             |
| Spec/Task actions                                   | **missing**  | **old-repo-available** via `GET/POST /api/specs/active/:slug/actions`                      | Preserve server-owned readiness/reasons; redesign around canonical new workflow identity.                                                                                           |
| Bulk Task selection validation/start                | **missing**  | partial: single-Task workflow actions plus Session `taskIds[]`/batch evidence              | Add application-owned validation for the whole selected set, returning legal action, warnings and blockers before dispatch; preserve the full selected Task set as execution scope. |
| Create/start Session                                | **missing**  | **old-repo-available** via `POST /api/agent-sessions` and workflow start actions           | Preserve Nevo-owned canonical `sessionId`, provider selection/reuse semantics and backend-owned workflow bootstrap; expose one shared Session-start interaction.                    |
| Task human decision                                 | **missing**  | **old-repo-available** via `POST /api/specs/:slug/tasks/:taskId/workflow/human-decision`   | Preserve explicit decision command pattern.                                                                                                                                         |
| Related Sessions                                    | **missing**  | **old-repo-available** via `GET /api/agent-sessions?specId=...&taskId=...`                 | Preserve contextual association but keep it separate from current execution; provide enough data for bounded recent-Session presentation/history access.                            |
| Spec-level current execution + multi-signal summary | **missing**  | partial only                                                                               | Add explicit projection.                                                                                                                                                            |

Bulk validation is a semantic application contract, not a frontend loop over individual Task
`ready` flags. A selected set can have selection-level warnings or blockers that do not exist on
one Task in isolation.

The exact read-model shape for cross-object attention and selection of one relevant recent Session
remains open. Do not freeze transport/API fields before the UX contract settles those semantics.

## 6. Information hierarchy and first scan

The current first-scan direction is:

1. **Specification identity/title** — the first stable visual anchor.
2. **Concise Specification description/orientation** — supporting context, quieter than the title and
   operational content.
3. **Requires attention** — when authoritative human-required attention exists, this becomes the
   strongest operational region immediately after orientation.
4. **Recent/relevant Session** — the normal resume-work target when prior work exists.
5. **Task collection** — the main remaining-work and next-work surface, especially when there is no
   relevant Session to resume.
6. **Session history/supporting documents/evidence** — deliberate deeper inspection.

The hierarchy must not be derived from backend object nesting, field count, or unused screen space.

### Specification orientation

The title should make the Specification identity obvious.

Show a bounded description preview, normally a few lines, with a low-emphasis `More`/equivalent
disclosure when the content is longer. The disclosure is not a primary action.

Opening the full Specification description/document should provide a comfortable reading mode that
uses the main available workspace surface rather than expanding a tiny inline accordion indefinitely.

Future editing: when a capable Markdown editor exists, that full reading mode may expose a small Edit
affordance and edit Markdown in place. Until then the full content is read-only and no dead Edit icon
is shown.

### Requires attention

When one or more authoritative conditions require the human, show one cross-object **Requires
attention** region before normal Session/Task content.

This is a priority summary, not another Task group and not a replacement Session list. It may
summarize attention originating from a Specification decision, Task review/decision, Session
question/permission, failed verification/build/check, or another deterministic workflow condition
whose authoritative semantics require the human.

Each item should answer **what needs me and why** using a bounded summary. The underlying Task,
Session, evidence resource, or workflow object remains in its normal structure/context.

Attention is a priority concept, not one fixed severity. Use attention/info, warning, or danger/error
according to actual meaning. Ready alone does not become attention.

The exact number of visible attention summaries before disclosure/overflow is still unresolved.

### Recent/relevant Session

When prior work exists, show one bounded Session target on the main surface instead of an unbounded
Session list.

Its information priority is:

1. meaningful Session title;
2. concise current/recent state or activity when authoritative;
3. bounded Task association when useful;
4. recency and technical identifiers as supporting/tertiary metadata.

Do not lead with an identifier such as `batch #23`.

Do not render one chip/pill per associated Task. For several Tasks, use a bounded aggregate such as
`3 tasks`. For exactly one Task, a short Task identity/title hint may be useful when the
authoritative read model provides it. A Session may also have no Task association.

Show role/archetype/provider/model only when the authoritative read model actually provides that fact
and it materially helps distinguish Sessions.

Expose a deliberate **Session history** target for older/relevant Sessions instead of making the main
Specification surface the history browser.

How the product chooses the one recent/relevant Session when several Sessions are plausible resume
targets remains an open product/UX decision.

## 7. Pseudo-layouts

The sketches describe hierarchy and relative placement, not final decoration or final Task groups.

### Wide

```text
┌──────────────┬──────────────────────────────────────────────────────────────┐
│ Navigation   │ Specification title                              [actions]   │
│              │ concise description...  More                                │
│ Specs        │                                                              │
│ Settings     │ Requires attention                         only when present  │
│              │  Review requires your decision                           >   │
│              │  Verification failed                                    >   │
│              │                                                              │
│              │ Recent session                                               │
│              │  Review authentication changes                          >    │
│              │  3 tasks · recent activity                                  │
│              │  Session history                                             │
│              │                                                              │
│              │ Tasks                                      Start session     │
│              │  ▾ Group A                                                    │
│              │  □ TASK-01  ...                                              │
│              │  □ TASK-02  ...                                              │
│              │                                                              │
│              │  ▾ Group B                                                    │
│              │  □ TASK-03  ...                                              │
└──────────────┴──────────────────────────────────────────────────────────────┘
```

When Tasks are selected:

```text
Tasks                          3 selected              [ Start session ]
```

The exact Task groups and row fields are intentionally not frozen by this draft.

### Compact

Preserve the same first-scan order:

```text
Title
description... More

Requires attention             when present

Recent session
Session history

Tasks
grouped rows
```

Secondary detail may remain split when workspace geometry supports it.

The current shared product contract still opens existing Session conversation as Full Session on
Compact. Whether Floating Session is also useful on some Compact widths is an explicit validation
question, not a decided change.

### Narrow

```text
Title
description... More

Requires attention             when present

Recent session
Session history

Tasks
grouped rows
```

Task/Session/evidence detail pushes in place of the Specification and provides Back.

Do not drop the attention region, recent Session target, or Task-selection meaning merely because the
layout is narrow.

## 8. Screen anatomy

- Specification header.
- concise summary/description + full-content reading action.
- cross-object Requires-attention region only when something genuinely requires the human.
- one bounded recent/relevant Session target.
- Session-history entry point.
- grouped Task collection with a stable checkbox/selection gutter.
- stable Task action region whose emphasis/availability changes with selection.
- Task search/filter only when needed.
- supporting documents/evidence.
- optional references to project-level changes/PRs/deployments/releases/pipelines.
- Task or other contextual Secondary when selected/opened.

Task collection should reuse the general grouped-list/scan principles from the design system, but its
group semantics and row information are product-specific and must not be copied from Specs Overview
merely because the visual grammar is similar.

## 9. Responsive contract

Wide/Compact:

- Specification remains Primary;
- Task detail and other contextual inspection may use Secondary;
- navigation breakpoint remains independent from workspace split.

Narrow:

- Specification first;
- Task row or another explicit contextual control pushes detail;
- Back returns to Specification;
- critical human attention remains visible before opening detail.

Specs Overview itself does not push Task detail from dynamic summary state; it enters the
Specification first.

### Compact Floating Session validation

Do not change the current shared behavior yet:

- Wide may use Floating Session;
- Compact/Narrow use Full Session.

Validate later whether Floating Session should also be supported in **Compact when enough usable
workspace width remains**, or whether it becomes too constrained compared with Full Session.

The validation must use actual rendered composition rather than breakpoint names alone and include at
least:

- realistic Specification content behind the floating surface;
- a long conversation;
- composer behavior;
- Work/commentary content;
- usable conversation reading width;
- viewport height;
- whether the underlying Specification context remains meaningfully visible;
- several Compact widths near the transition boundary.

This validation may justify a later shared interaction-model change. Until then this draft must not
override the current shared product contract.

## 10. Interaction flows

### Create, prepare and refine a Specification

```text
create Specification (optional prepared content; optional agent initialization)
  -> Specification exists independently of the initialization Session
  -> open Specification and orient from title/available description
  -> resume initialization Session or explicitly start a Specification conversation
  -> agent fills/refines files and adds Tasks
  -> Specification content/Task projection updates from authoritative changes
  -> inspect documents and Tasks, including Draft/review work
  -> select legally executable Tasks once preparation/review permits execution
```

Before Tasks exist, expose a readable Specification-content target and the normal Session entry.
Do not simulate deterministic Specification phases or present Add Task as the expected path.
An empty Specification must explain the preparation path rather than imply that no work is possible.

### Return, inspect and execute Tasks

```text
open Specification from Overview or its route
  -> recognize Specification and any cross-object human attention
  -> inspect attention context when required, or resume a relevant Session
  -> scan configured Task groups
  -> open a Task for context or select several Tasks for execution
  -> validate the whole selected set and explain warnings/blockers
  -> start shared agent interaction with the complete Task scope when legal
  -> display authoritative feedback and return/resume with context preserved
```

Opening an attention item or Task does not execute or decide. A Session may cover several Tasks;
do not reduce its scope to the Task from which it was opened.

### Extend a Specification during execution

```text
Specification contains existing/in-progress/completed Task work
  -> explicitly start or resume a Specification conversation
  -> discuss scope expansion/refinement
  -> agent adds/refines content and Tasks through the shared product operations
  -> new Tasks appear in backend-supplied groups
  -> existing execution, inspection context and checkbox selection remain understandable
```

Starting a conversation is distinct from executing selected Tasks. Unselected Tasks must not be
silently added to an execution batch merely because refinement created them.

### Select Task

Task row -> local Task Secondary; no workflow mutation.

### Multi-select Tasks

Checkboxes remain visible as a stable leading Task-row anchor even when nothing is selected.
Selection does not require entering a temporary selection mode.

Keep the selection action region geometrically stable.

With no Tasks selected:

- do not show a meaningless `0 selected`;
- a selection-dependent action may remain visible but quiet/disabled when that preserves
  discoverability and geometry.

With one or more Tasks selected:

- show selected count when useful;
- enable/promote the legal action according to authoritative readiness;
- selection changes action emphasis/availability rather than causing surrounding layout reflow.

For Start:

```text
select Tasks
  -> backend validates selection/action
  -> show warnings and blockers
  -> if legal, shared Session-start interaction chooses agent/provider as needed
  -> preserve the selected set as batch scope
```

Unmet dependencies or other readiness facts remain visible. Warning != blocker: a warning can leave
the action available; a blocker prevents it and explains why. Frontend does not calculate this from
status strings.

### Filter Tasks

Local filter narrows already-loaded summaries by id/title/semantic steering category when useful.

### Specification-level decision

Cross-object attention may link to the owning evidence/decision context, but the decision remains
owned by the underlying Specification/Task/Session workflow semantics.

### Start/continue/review

Action availability comes only from authoritative readiness. Command -> pending feedback ->
authoritative projection update.

### Existing Session

Current shared behavior remains:

- Wide conversation target may open Floating Session;
- Compact/Narrow open Full Session;
- an explicit Open full session action may coexist on Wide.

The possibility of Floating Session on some Compact widths remains an open rendered-validation
question defined in the responsive contract above.

### Session history

Session list/history opens deliberate contextual detail instead of expanding all Sessions on the
main Specification surface. It belongs to this Specification, includes current and settled
conversations, and offers the shared start action for a new Specification conversation. The exact
entry label and visible-action placement remain composition decisions.

### New Session

New session -> shared Session-start interaction -> choose agent/provider and optional execution
details -> normal Session/composer. Do not embed another standalone prompt editor here.

Starting a Session from selected Tasks must preserve the complete selected Task set.

The exact placement of New session as a persistent visible header primary action versus
overflow/body context remains open for composition review.

### Documents/evidence

Document/artifact/evidence target -> read/inspect contextual detail. Any approve/reject action comes
from the owning workflow Human Step, not the viewer itself.

## 11. States

### No attention

Flow directly from orientation to recent Session and Tasks.

### Human attention exists

Requires attention becomes the strongest operational region after orientation. Underlying Task,
Session, and evidence objects remain in their normal structure.

### Relevant recent Session exists

Show one bounded resume-work target plus Session-history access.

### No relevant recent Session

Do not render a fake empty Session card. Task collection becomes the main operational body and a
legal new-Session path remains available.

### No Task selection

Checkboxes remain visible. Selection-dependent action is not primary. Do not show `0 selected`.

### Task selection

Show useful selection count and promote/enable the legal action without moving the action region.

### Workflow/execution states

The screen may also need to represent:

- normal/quiet;
- ready;
- current single Task execution;
- current batch execution;
- issue/remediation;
- resumable/continue;
- recovery required;
- partial evidence unavailable;
- archived/read-only Spec.

These states should change content/action availability/semantic emphasis without arbitrarily
reconstructing the Task-row skeleton or first-scan hierarchy.

## 12. Data loading, events, and Refresh

This screen inherits
[Data loading, refresh, batching, and eventing](../data-loading-refresh-and-eventing.md).

### Projection boundaries

Load one coherent Specification steering projection containing:

- Spec workflow/actions;
- Task semantic summaries/actions;
- high-priority attention signals;
- current execution summaries;
- lightweight document/evidence/Session references.

Do not bundle all document bodies, Session histories, diffs, or raw artifact bodies into that request.

Documents/details load lazily when opened. If several homogeneous documents are intentionally needed
together, use the shared bounded batch-read pattern rather than N uncontrolled requests.

### Event updates

A Task/workflow change that affects both Task detail and Spec steering should update/invalidate those
two projections together from one semantic event/operation completion.

Do not invalidate every document or Session because one Task status changed.

### Refresh

Expose one Specification-level **Refresh** in the header/overflow.

It refreshes:

- the Specification steering projection;
- Spec/Task action readiness contained in that projection.

It does not automatically refetch:

- every document body;
- historical Session transcripts;
- unopened Handover/artifact bodies;
- file/diff details.

If an open detail has its own revision/stale signal, refresh that detail independently.

Keep visible data during refresh. Async actions should normally wait for their terminal
operation/event before forcing a final refresh; do not refetch repeatedly for every progress event.

## 13. Component / composition map

| Need                      | Composition                                                    |
| ------------------------- | -------------------------------------------------------------- |
| Main layout               | AppWorkspace                                                   |
| Header                    | WorkspaceHeader                                                |
| Description disclosure    | shared disclosure/text primitives                              |
| Requires-attention region | SpecFlow product composition using semantic feedback sparingly |
| Recent Session target     | SpecFlow product composition                                   |
| Session history detail    | SpecFlow product composition + workspace Secondary             |
| Task rows/groups          | SpecFlow product composition                                   |
| Task selection/actions    | Nevo UI form/action primitives in product-owned composition    |
| Status metadata           | StatusIndicator/Badge sparingly                                |
| Evidence prose            | Typography/MarkdownDocument                                    |
| History                   | Timeline when genuinely chronological                          |
| Task/detail navigation    | product Secondary/local workspace stack                        |

Do not create generic design-system `Specification`, `SessionSummary`, or `TaskRow` components
merely because markup is reused inside SpecFlow.

## 14. Visual/token contract

- workspace surface: existing AppWorkspace material;
- Specification title is the first stable visual anchor;
- description/supporting explanation uses lower visual weight;
- metadata uses `text-content-muted`;
- Task rows are neutral by default with shared hover/selected interaction treatment;
- Task selection gutter and action region remain geometrically stable;
- group boundary should be stronger than row boundary when grouping carries meaning;
- divider is subtle and used only where spacing/alignment is insufficient;
- Requires attention uses semantic tone with greater weight only when present;
- ready is a calmer semantic action state, not attention;
- current execution uses running/activity treatment, not warning;
- issue/recovery uses semantic warning/error according to actual condition;
- Session identity is title-first, not technical-id-first;
- Task association and other metadata are bounded instead of expanding into pill/tag soup.

## 15. Local containment rules

The screen is borderless-first.

- no Card around the whole Specification;
- no Card around the description;
- no Card per Task;
- no permanent Card around Task collection or each Task group;
- no stack of Session cards on the main surface;
- no Card per evidence section;
- the Requires-attention region may earn stronger containment because it is exceptional and
  cross-object;
- Recent Session remains a lightweight resume-work target rather than a dashboard tile;
- use headings, spacing, shared alignment, and subtle dividers before stronger containment;
- never Card-inside-Card between Primary and Secondary content.

## 16. Accessibility/focus

- Task rows keyboard-operable;
- Task checkbox/selection control does not trigger row navigation;
- row navigation and nested controls remain valid semantic siblings rather than nested interactive
  elements;
- selected Task is semantically indicated;
- opening Secondary moves focus to meaningful detail; Back/Close restores useful origin context;
- statuses/attention severity are not color-only;
- description disclosure exposes expanded/collapsed state;
- disabled/unavailable actions expose authoritative reason through accessible supporting text, not
  tooltip-only.

## 17. Storybook / rendered validation scenarios

The eventual UX exercise should include at least:

- normal Specification with recent Session and grouped Tasks;
- empty Specification created without agent initialization;
- preparing Specification with initialization Session and no Tasks yet;
- Tasks present but still in Draft/review;
- later refinement adding Tasks alongside existing execution/completed work;
- custom ordered Task groups with several workflow statuses mapped to one group;
- attention from a Task;
- attention from a Session;
- heterogeneous multiple attention items;
- no relevant recent Session;
- Session with no Tasks;
- Session with one Task;
- Session with many Tasks rendered as one bounded aggregate;
- long Session title;
- long Specification title/description;
- no Task selection;
- one selected Task;
- several selected Tasks;
- long/dense Task rows once the Task-row contract is defined;
- large Task collection with local search/filter if filtering remains justified;
- single Task execution;
- batch execution;
- remediation/resume/recovery;
- archived/read-only;
- Wide and ultra-wide;
- several Compact widths near the workspace transition;
- Narrow pushed Task/detail;
- Compact Floating Session comparison using realistic background Specification content, long
  conversation, composer, Work/commentary, and viewport-height pressure.

Validation should check first-scan order, Task-selection geometry, information density, long-content
resilience, and that Session/Task associations do not become pill/tag soup.

## 18. Acceptance direction

The following conclusions are currently strong enough to preserve for the later UX exercise:

- Specification identity is the first stable visual anchor.
- Description supports orientation without competing with operational content.
- Human-required attention, when present, appears before normal Session/Task work.
- Attention is a cross-object summary and does not replace underlying Task/Session structure.
- Main surface shows one bounded recent/relevant Session target rather than an unbounded Session list.
- Session title dominates Session identifiers and technical metadata.
- Many associated Tasks are summarized rather than rendered as one pill/chip per Task.
- Task selection controls remain part of stable list geometry.
- Zero selection does not produce `0 selected`.
- Selection changes action emphasis/availability rather than reflowing the layout.
- Starting a selected-Task Session preserves the complete selected set.
- Task groups/row semantics are not copied from Specs Overview without an explicit product decision.
- Secondary/detail navigation preserves Specification context and does not mutate workflow state.
- The composition remains borderless-first and avoids Card/pill/status soup.
- Frontend does not invent workflow/Session semantics from DTO strings.

These are draft design inputs, not yet an authoritative Specification screen contract.

## 19. Open questions

The later UX Designer exercise should explicitly resolve or validate:

- capability-provided local destination inventory beyond core views;
- document collection/reading flow, including parent Back and preserved work-view context;
- whether Sessions remains contextual Secondary or becomes a Specification-local main destination;
- summary placement/information budgets for capability-provided sections and their detail targets;
- repository/worktree ownership and trustworthy change attribution when context is shared;
- default Task group examples and presentation of user-configured groups; user/backend ownership
  of group definitions, ordering and status mapping is settled above;
- exact Task-row information budget and comparison columns;
- how the product selects the one recent/relevant Session when several Sessions are plausible resume
  targets;
- exact maximum number of attention summaries before the region needs bounded disclosure/overflow;
- whether New session deserves the persistent visible header primary slot or remains in
  overflow/body context;
- future deterministic Specification steps/statuses and whether Specification-wide deployment
  belongs to a Task or a Specification step;
- whether Floating Session should also be supported on some Compact widths when enough usable
  workspace remains, or whether Full Session is still materially better;
- final Spec workflow/read-model shape, after UX semantics above are settled;
- canonical artifact/Handover references;
- exact bulk-action command envelope and selection-validation projection;
- exact document editing implementation once Markdown editing is introduced;
- exact project-level operations surface once deployment/command/pipeline capabilities exist.
