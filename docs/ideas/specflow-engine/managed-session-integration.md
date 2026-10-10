---
id: ideas.specflow-engine.managed-session-integration
type: architecture
title: Managed Sessions and Engine execution integration
status: draft
scope: specflow
areas: [ai, runtime, workflow, security, testing]
tags: [sessions, turns, admission, handover, crash-recovery]
read_when:
  - migrating Nevo Session and Turn lifecycle into SpecFlow Runtime
  - integrating a managed provider Turn with Engine workflow and workspace claims
summary: >
  Proposed managed execution handshake, correlation identities, read-only Turn behavior,
  provider dispatch recovery, and explicit batch/handover boundaries.
related:
  - ideas.specflow-engine
  - ideas.specflow-engine.boundaries
  - ideas.specflow-engine.execution-scopes
  - ideas.specflow-engine.workspace-binding-lifecycle
  - ideas.specflow-engine.local-actors
  - architecture.ai.canonical-session-turn-work
  - architecture.ai.provider-boundary
---

# Managed Sessions ↔ Engine integration

## Purpose and authority

`Runtime Sessions` owns canonical Session/Turn/Work lifecycle, provider invocation, transport, interactions, streaming and cancellation. `Engine` owns Specs, workflow readiness/transitions, physical workspace admission/claims and durable mutation recovery. Neither layer delegates its authority to the other.

Existing [Session/Turn/Work architecture](../../architecture/ai/canonical-session-turn-work.md) currently permits `ProviderSessionRef` as a **temporary** canonical locator until an application-owned Session ID exists. Migration should explicitly decide on a stable product `sessionId`, retaining the composite provider-native locator for adapter correlation. This is a *proposed normative change*, not already adopted.

## Independent identities

| Identity | Owner | Stability and meaning |
| --- | --- | --- |
| `sessionId` | Runtime Sessions | Durable product conversation identity, independent of native provider |
| `turnId` | Runtime Sessions | One requested logical invocation; retries preserve idempotency |
| `providerSessionRef` | Provider adapter/Runtime | `(provider, providerSessionId)`; may be replaced on safe native recovery |
| `workspaceId` | Engine Workspace | Local workspace identity; never use stored `cwd` as identity |
| `executionId` / claim reference | Engine admission | Optional ownership of physical mutations; **not** the Turn identity |
| `workflowAttemptRef` | Engine Workflow | Optional `(change, task, step, attempt)`, never inferred from historical Session binding |
| `invocationId` | Runtime dispatch | One provider dispatch attempt, used to fence late callbacks and unknown outcomes |

A Session can reference Specs/Tasks historically and may have different active scope per Turn. One Turn may be ad-hoc and have no task/claim; one workflow attempt may span more than one Turn. A Turn ending does not automatically advance/finish workflow.

## Minimal managed execution handshake (future integration contract)

```text
Runtime: accept intent + authorize user / Session operation
     -> resolve current Spec/Workspace through Engine (verify membership)
     -> derive Turn intent + effect scope (read-only/write/Git)
     -> Engine inspect readiness / conditional admission and claim
     -> Runtime persist Turn + provider invocation INTENT (idempotent)
     -> dispatch provider with verified workspace cwd and validated mode
     -> persist provider correlation and invocation dispatch evidence
     -> consume normalized events; own streaming/interactions/cancel
     -> settle Turn outcome exactly once
     -> Engine reconcile/release claim when ownership can be proved settled
     -> explicit workflow operation completes/advances attempt if requested
```

This is an **intent protocol**, not a single ACID transaction between Engine state, Runtime journal and provider process. Decide stage ordering so a crash after claim acquisition but before Runtime intent is discoverable; persist enough correlation on **both sides** to reconcile. Reject indefinite orphan claims, but never replay provider dispatch merely because a native session ID was not persisted.

### Dispatch uncertainty

Distinguish at least `prepared` (not dispatched, proven), `dispatching/unknown` (provider may have begun work), and `started` (correlation persisted or provider progress observed). These are semantic milestones; do not copy legacy field names blindly. Crash between spawn and provider ID persistence is **unknown**, not permission to start another Turn automatically. Use positive evidence of process settlement/side-effect disposition before any replay. A terminal provider process with unproven tool effects remains ambiguous for writer safety.

### Turn settlement is not Workflow completion

- Runtime may mark a Turn terminal while Engine task stays active, ready to resume, or awaiting human review.
- Engine releases a claim only when its own ownership and mutation evidence meet release policy.
- Engine `workflow step finish` is an explicit deterministic action, not a side effect of `Turn terminal` or `handover`.
- No automatic creation of a new review/implementation Session by Turn completion unless a separately approved workflow explicitly requests it.

## No workflow / no writer cases

Ordinary chat, design planning and read-only analysis can create managed Turns without a Workflow attempt. Read-only execution may not need a physical writer claim **only if the actual tool capability/enforcement prevents writes**; a label of `readOnly` is insufficient. A Spec Writer writing a draft may need writer admission **without a taskId or workflow attempt**. Source-control-changing operations may need Git/ref-level coordination as well as workspace coordination.

## Workspace resolution and native resume

Every new Turn/start/resume resolves the current `workspaceId -> verified root` through Engine; Runtime passes that root at provider invocation rather than constructing one provider adapter permanently bound to a project-global `cwd`. If workspace moved, disappeared or was rebound, check provider-native resume compatibility; never silently reuse the previous native session just because `providerSessionId` exists. A missing workspace must not erase readable Session history. See [workspace binding lifecycle](workspace-binding-lifecycle.md).

## Batch and handover

- **Batch:** one Session/Turn may own an explicit ordered set of Task attempts, but each Task retains its own workflow identity, gates and evidence. Engine controls per-task admission and progression, never guesses a 'primary' task from Session history.
- **Handover:** Runtime may create a new Session with predecessor/handoff context on explicit request. New Session does not inherit a claim or auto-start a workflow step merely because a previous Session linked to that Task.
- **Retry:** durable invocation intent and idempotency keys fence concurrent starts; provider-native resume policy is separate from workflow retry policy.
- **Cancellation:** cancelling a Runtime-managed Turn is not sufficient proof that every external tool side effect stopped. Engine admission remains blocked if actual write outcome is ambiguous.

## Authorization and observation

Runtime authorizes Session access and requested Specs/Tasks after Engine resolves their canonical binding. HTTP-supplied `workspaceId`, `sessionId` and `taskId` are selectors, not access grants. Do not leak unauthorized Session history into an allowed Specs aggregation. External manually launched provider runs are **not** Runtime Sessions.

## Promotion gate / later tests

After Foundation A and minimal coordinator, implement Sessions without workflow first, then test managed execution with a mock provider: S01 standalone chat; S02 writer Turn + Engine claim; S03 terminal Turn without workflow finish; S04 multi-task execution scope; S05 handover without step advance; S06 crash at each dispatch milestone, no duplicate provider invocation; S07 moved/missing workspace and safe native resume; S08 scoped authorization across Sessions/read models. These are **Sessions integration gates**, not Foundation A pass conditions.
