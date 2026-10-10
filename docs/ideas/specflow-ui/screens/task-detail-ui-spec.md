---
id: ideas.specflow-ui.screens.task-detail
type: product
title: Task Detail UI spec
status: draft
scope: specflow
areas: [ui, workflow]
tags: [task, detail, review, evidence, actions]
read_when:
  - implementing or reviewing Task Secondary/pushed detail
  - defining Task evidence, decisions, or action placement
summary: >
  Vertical UI specification for Task detail: decision state, intent, evidence, current execution,
  deterministic actions, API/read-model requirements, components, tokens, and responsive behavior.
related:
  - ideas.specflow-ui.screens
  - ideas.specflow-ui.spec-task-information-hierarchy
  - ideas.specflow-ui.spec-task-screen-structure
  - product.specflow.ui.interaction-model
---

# Task Detail UI spec

The owner refined presentation during Specification UX review: row activation opens a short
description/metadata preview; a distinct trailing action or preview action opens Full Task as a
main surface. The complete screen draft is currently kept in the ignored local planning area.
The decision/evidence inventory below remains input for Full Task, not a requirement to put it all
in preview. Earlier inspector-only/deep-link statements describe the previous proposal.

## 1. Purpose and ownership

Task Detail answers within seconds:

- What is this Task?
- Why is it in this state?
- Does it need me?
- What evidence should I inspect?
- What deterministic action is available?

Task detail is normally a contextual Secondary of Specification, or pushed detail on narrow layouts.

It does not own global Specification navigation, Full Session layout, or raw provider/runtime payloads.

## 2. User use cases

- Inspect Task intent/acceptance criteria.
- Understand why review/approval/remediation is required.
- Start/continue an available deterministic action.
- Review Task-specific evidence and shared artifacts.
- Distinguish current execution from historical/related Sessions.
- Open a related Session without losing Task context.
- Inspect changes/verification/Handover.
- Recover from or inspect an execution issue.

## 3. Entry and navigation

Entry:

- Task row from Specification;
- explicit Task target from Session Context or another owning detail surface.

Specs Overview does not deep-link directly to Task Detail from dynamic summary/status content; it
first enters the owning Specification, where the concrete Task context becomes explicit.

Short Task Preview is local Secondary/pushed-detail state. Full Task is a distinct main route at
`/specs/:specId/tasks/:taskId`, not a substate of the Workspace Task list. It is addressable
from other product surfaces and must resolve detail via the independent Task read API.

Wide/Compact:

- Specification or Session remains Primary;
- Task occupies Secondary.

Narrow:

- Task replaces visible Primary context as pushed detail;
- Back returns to originating Specification/Session context.

The same Task detail composition should work in either parent context without changing Task semantics.

## 4. Data source / read-model ownership

Backend/application owns:

- Task identity/title/intent reference;
- semantic workflow state;
- per-action readiness/reason;
- current execution membership;
- dependencies/blockers;
- review/evidence/artifact references;
- current/historical related Sessions;
- continue/resume/recovery projection.

Frontend may order evidence according to the current decision but must not invent missing verdicts,
workflow state, or execution membership.

## 5. API availability / migration status

| Need                                          | New SpecFlow | Old repo evidence                                                                          | Direction                                                                         |
| --------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Task identity/status/dependencies             | **missing**  | **old-repo-available** in \`GET /api/dashboard\`, \`.../task-statuses\`, manifest          | Preserve factual metadata; replace legacy universal lifecycle semantics.          |
| Task document/body                            | **missing**  | **old-repo-available** via \`GET /api/specs/:source/:slug/content/:docId\`                 | Strong migration candidate.                                                       |
| Per-action readiness/workflow projection      | **missing**  | **old-repo-available** via \`GET /api/specs/active/:slug/actions\`                         | Preserve server-owned readiness and workflow projection.                          |
| Human review command                          | **missing**  | **old-repo-available** via \`POST /api/specs/:slug/tasks/:taskId/workflow/human-decision\` | Preserve explicit command behavior.                                               |
| Related Sessions                              | **missing**  | **old-repo-available** via \`GET /api/agent-sessions?specId=...&taskId=...\`               | Keep association separate from current execution.                                 |
| Current execution membership / batch context  | **missing**  | partial legacy evidence only                                                               | Add authoritative current-execution projection.                                   |
| Handover/artifact/change/verification summary | **missing**  | partial scattered legacy evidence                                                          | Add explicit references/read model; do not invent one generic Attachments bucket. |
| Resume vs recovery                            | **missing**  | deterministic legacy flow has behavior/evidence, not one clean Task detail DTO             | Add stable application projection.                                                |

### Old-repo field evidence

Legacy Task/list projections already expose:

```text
SpecificationTask
  id
  title
  status
  stage
  order
  dependsOn[]
  blockedBy[]
  ready
  terminal
  file

SpecificationTaskActionGate
  action
  enabled
  reason
  availableActions?
  status?
  currentStep?
  attempt?
  workflowState?
```

Legacy Task document reads also provide:

```text
id
docId
kind
title
path
available
markdown
status
order
dependsOn[]
```

Migrate factual identity/order/dependency/document fields and server-owned action facts.

Do not preserve \`ready\`, \`terminal\`, or legacy \`stage\` as sufficient new-UI semantics.
\`attention\`, \`currentExecutions[]\`, typed \`evidence[]\`, and \`continuation\` are new projections.

### Proposed Task read API

Illustrative:

```text
GET /api/specs/:specId/tasks/:taskId
```

Response:

```text
{
  revision,
  updatedAt,
  task: {
    id,
    specId,
    title,
    order?,
    intent: {
      summary?,
      documentRef?,
      acceptanceCriteria?,
      constraints?,
      dependencies[]
    },
    workflow: {
      semanticStatus,
      currentStep?,
      attempt?,
      state?,
      reason?,
      actions: [
        { id, label, available, reason?, confirmation? }
      ]
    },
    attention?: {
      kind,
      label,
      reason,
      decisionType?
    },
    currentExecutions: [
      {
        sessionId,
        agentRole,
        taskIds[],
        currentActivity?,
        startedAt?
      }
    ],
    evidence: [
      {
        id,
        kind,
        title,
        summary?,
        relevance,
        status?,
        target,
        sharedTaskIds?,
        updatedAt?
      }
    ],
    sessions: [
      {
        id,
        title?,
        relation: "current" | "historical" | "contextual",
        provider?,
        archetype?,
        agentRole?,
        batchId?,
        taskIds[],
        workflowStep?,
        attempt?,
        lastActivityAt?
      }
    ],
    sessionHistory: {
      hasMore,
      total?
    },
    continuation?: {
      kind: "none" | "continue" | "remediation" | "recovery",
      reason,
      actionId?
    }
  }
}
```

Suggested commands:

```text
POST /api/specs/:specId/tasks/:taskId/actions/:actionId
POST /api/specs/:specId/tasks/:taskId/decisions
```

Decision body example:

```text
{ decision: "approve" | "request-changes", feedback? }
```

Field coverage notes:

- `revision/updatedAt` protect Task detail from stale out-of-order refreshes.
- `workflow.actions[]` is the legal-action source; `semanticStatus` is descriptive, not command
  authorization.
- `currentExecutions[]` is plural deliberately so read-only review/other concurrent execution
  contexts are not silently lost.
- `evidence.sharedTaskIds[]` preserves multi-Task artifacts without cloning them as fake
  Task-specific reports.
- `sessions[].relation` distinguishes contextual/history from actual current execution.
- provider/archetype/batch/workflow metadata is factual orientation only; it does not prove which
  Session completed a transition unless workflow/history evidence references that Session.
- `sessionHistory.hasMore` supports a bounded useful list plus Show all without assuming Session
  history is always small.
- a future evidence/session reference may add a Turn anchor without changing Session identity.
- `continuation.kind` makes continue/remediation/recovery mutually explicit in the projection.

Behavior:

- server validates legal action at command time;
- stale UI readiness does not authorize a command;
- successful command returns operation/result identity and new projection can be fetched/streamed;
- Task terminal status is not inferred from terminal Turn;
- each \`currentExecutions[].taskIds\` may contain several Tasks;
- evidence entries may point to shared multi-Task artifacts;
- `kind: changes` is not assumed to be singular: a Task may expose several change-set references
  (for example worktree, base-branch diff, PR/MR) or one application-owned aggregate that preserves
  those sources; the UI must not hard-code GitHub/GitLab semantics.

## 6. Information hierarchy

1. Task identity/title.
2. decision/current state + human-readable reason.
3. available deterministic action.
4. Task intent/acceptance criteria.
5. decision-relevant readable evidence.
6. current execution plus several relevant Sessions/history.
7. deep technical/history detail.

Active/current Session is visually distinguishable from historical/contextual Sessions. Session
labels use facts such as provider, archetype/role, batch/scope, step/attempt when available; they do
not infer that an archetype alone proves completion of a review/implementation stage.

## 7. Pseudo-layout

```text
┌──────────────────────────────────────┬──────────────────────────────────────┐
│ Specification Primary                │ TASK-03 — Deterministic admission    │
│                                      │ Review required                 [×]  │
│ Tasks                                │                                      │
│ TASK-01  Done                        │ Why                                  │
│ TASK-02  Working                     │ Owner decision required              │
│ TASK-03  Review required       >     │                                      │
│ TASK-04  Ready                       │ Task intent                           │
│                                      │ ...                                  │
│                                      │                                      │
│                                      │ Review / Handover / Changes          │
│                                      │ readable evidence                    │
│                                      │                                      │
│                                      │ Sessions                             │
│                                      │ ● Reviewer · batch #23       [Open]  │
│                                      │   Implementer · earlier      [Open]  │
│                                      │   [Show all]                          │
│                                      │                                      │
│                                      │ [Review / decide]                    │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

No Card per section.

## 8. Screen anatomy

- header: Task id/title + workflow meaning + Close/Back;
- decision state and action;
- Task intent;
- readable decision evidence;
- current execution;
- related Session list with active/current emphasis and bounded history;
- Show all when Session history exceeds the normal visible budget;
- deep inspection.

Optional sections disappear when unavailable.

## 9. Responsive contract

Wide/Compact:

- Secondary alongside parent Primary;
- Task owns its own header/actions.

Narrow:

- pushed Task surface;
- Back to parent;
- same evidence/action order;
- action may use sticky placement only if it does not obscure evidence/composer-like content.

## 10. Interaction flows

### Review

Review-required -> inspect evidence -> deliberate Review/decide -> workflow-owned decision controls.

### Ready

Ready -> understand what Start does -> Start -> authoritative validation/dispatch.

### Current execution / Session history

Show authoritative current execution separately from related history.

Opening a Session:

- Wide -> Floating Session for conversation access, with Full Session available;
- Compact/Narrow -> Full Session directly.

A workflow/history entry that references a Session opens that Session. Do not insert a synthetic
"proof details" page. A future Turn anchor may scroll/open the exact completion Turn.

### Evidence

Handover/verification/artifact/change reference -> same Secondary local stack -> Back returns to Task.
Artifacts are read targets; workflow Human Step owns any approve/reject mutation.

### Resume

Safe settled execution + legal work remains -> Continue.

### Recovery

Ambiguous durable operation -> Inspect recovery -> authoritative recovery action. Do not label it
ordinary Continue.

## 11. States

- ready;
- current execution;
- human review;
- owner decision;
- operation-specific issue/blocker;
- quiet/no immediate action;
- resume/continue;
- remediation;
- recovery required;
- archived/read-only;
- evidence unavailable.

## 12. Data loading, events, and Refresh

This screen inherits
[Data loading, refresh, batching, and eventing](../data-loading-refresh-and-eventing.md).

Task state, legal actions, attention, continuation/recovery, and current execution must come from one
coherent Task projection/revision because the user interprets them together.

Large evidence bodies remain lazy:

- Task document body;
- review report;
- Handover;
- diff/change detail;
- verification/raw logs;
- historical Session detail.

### Event updates

When a workflow operation changes Task state, update/invalidate:

- this Task projection;
- the parent Specification steering projection.

Do not invalidate unrelated Tasks' heavy evidence.

A burst of progress events may update a lightweight current-execution summary, but should be
coalesced according to the shared event rules.

### Refresh

Task Detail does not need a prominent standalone Refresh button when parent/live invalidation is
healthy.

If exposed in the Task overflow for diagnostics/manual recovery, it refreshes **only the Task
projection**.

An opened evidence detail refreshes separately if that resource has its own revision/stale state.

Do not make Task Refresh refetch every related Session, document, and diff.

The detailed decision/evidence composition is defined in
[Task decision and evidence UI spec](../components/task-decision-evidence-ui-spec.md).

## 13. Component / composition map

| Need                        | Composition                                                            |
| --------------------------- | ---------------------------------------------------------------------- |
| Secondary shell             | AppWorkspace runtime Secondary                                         |
| Header                      | WorkspaceHeader                                                        |
| Task prose                  | Typography / MarkdownDocument                                          |
| Decision summary            | product composition; Alert only when stronger containment is justified |
| Evidence disclosure         | Collapsible / rows / links                                             |
| Chronological history       | Timeline                                                               |
| Status                      | StatusIndicator/Badge sparingly                                        |
| Actions                     | Button/Menu/AlertDialog when confirmation needed                       |
| Session entry               | product conversation target + direct Full Session action               |
| File/change/evidence detail | replace current Task Secondary via local detail stack                  |

## 14. Visual/token contract

- normal surface neutral;
- title: \`text-content-primary\`;
- explanatory prose: \`text-content-secondary\`;
- metadata: \`text-content-muted\`;
- separators subtle;
- attention/recovery semantic tones only where meaning requires;
- ready action uses normal action hierarchy, not warning colors;
- review evidence stays neutral unless finding severity itself is semantic.

## 15. Local containment rules

- no Card per evidence type;
- no Card around Task intent;
- no Card around entire Task detail;
- stronger contained state may be used for one exceptional attention/recovery block;
- shared review/Handover artifacts can be independently contained only if they function as distinct
  selectable objects;
- nested containment is exceptional.

## 16. Accessibility/focus

- opening Task focuses Task heading or first meaningful context;
- Back/Close restores focus to originating row/signal;
- action reason is readable without hover;
- collapsed evidence has clear accessible labels/state;
- statuses never color-only;
- confirmation dialogs name the Task/action clearly.

## 17. Storybook scenarios

- ready-to-start;
- current single Task;
- current batch;
- review required;
- waiting dependency;
- remediation available;
- continue/resume;
- recovery required;
- shared review artifact;
- several related Sessions with one active;
- long Session history with Show all;
- Session metadata without inferred role completion;
- no optional evidence;
- narrow pushed detail.

## 18. Acceptance criteria

- state/reason understood before mutation;
- evidence is directly reachable and returns through the local Secondary stack;
- artifacts/documents are readable without acquiring generic mutation buttons;
- current execution is authoritative and batch-aware;
- Session association is not execution proof;
- multiple useful Session history entries are visible without flooding pathological history;
- active/current Session is easy to find;
- clicking a referenced Session opens that Session directly;
- terminal Turn does not imply Task complete;
- linear detail remains borderless-first.

## 19. Open questions

- canonical Handover/artifact references;
- exact initial change/diff inspection contract;
- exact workflow action identifiers in new model;
- exact review decision variants defined by configured Human Steps;
- exact default visible Session-history count (design around a small handful, not a hard domain cap);
- future Turn-anchor shape for workflow/history -> Session navigation.
