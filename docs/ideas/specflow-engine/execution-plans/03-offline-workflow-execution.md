---
id: ideas.specflow-engine.plan-03
type: engineering
title: Temporary execution plan 03 — Offline Workflow and Execution
status: draft
scope: specflow
areas: [workflow, cli, security, testing]
tags: [execution-plan, temporary, offline, claims, workflow]
read_when:
  - executing the temporary Engine migration proof of concept
  - reviewing implementation tasks, verification and dependency gates
summary: >
  Disposable implementation plan for deterministic offline workflow, effect-scoped claims, trustworthy gates, and actionable recovery.
related:
  - ideas.specflow-engine
  - ideas.specflow-engine.acceptance
  - ideas.specflow-engine.test-plan
  - architecture.principles.enforceable-invariants
---

# Plan 03 — Offline Workflow and Execution

**Lifecycle: temporary implementation plan.** This is an implementation worklist for **Foundation B**, not a normative workflow specification. Source of truth remains current [deterministic workflow architecture](../../../architecture/workflow/deterministic-workflow.md); [PR #50 ideas](https://github.com/dczerwinskipl/nevo-specflow/pull/50) are candidate detail.

## Required observable scenario

A person launches an **external** agent in a verified checkout. Runtime can remain stopped throughout. The agent's skill calls product CLI to inspect readiness, explicitly start one real step, edit the expected workspace, inspect/check and explicitly finish the step. A fresh CLI process later resumes the same deterministic Task/attempt. Another competing writer is blocked; another independent worktree may proceed. When Runtime does run, it observes the real Engine workflow state without inventing Session/Turn history for the external agent.

There must be **one real** minimal workflow definition, one real Task and an actual transition. A fake `step start` endpoint or global in-memory lock cannot count as proof.

## Task sequence

| Task | Implement and prove | Depends on |
| --- | --- | --- |
| E3.T01 — Legacy fact check | Inspect `dczerwinskipl/nevo` current deterministic workflow `start-operation`, `finish-operation`, `readiness-policy`, `step-context`, `operation-record`, `workspace-writer` and relevant tests. Classify port/refactor/replace/delete; do not migrate old queue or Runtime-only Session imports. | Plans 01–02 |
| E3.T02 — Workflow definition/identity | Build declarative workflow loader and validation within Engine. Resolve definition from **target execution workspace**; pin immutable definition provenance to attempt (digest/retained content or verified Git object). Respect identity `(change, task, step, attempt)` and versioned transition semantics. | T01 |
| E3.T03 — Readiness/step state | Implement read-only `inspect`, readiness and blocker reporting; explicit `start` activates or resumes, `finish` completes without automatically starting the next step; enforce declared transition branch. Preserve one canonical state, not UI/status duplicates. | T02 |
| E3.T04 — Verification boundary | Distinguish nonmutating `inspect/check` from `verify/execute`. Verification commands belong to the declared task/gate, **not** generic all-project test commands. A docs index generator is a declared production/post-action or explicit gate as appropriate, not an implicit blocker for an unrelated review. | T03 |
| E3.T05 — Physical admission | Derive execution effect scope (read-only enforced vs workspace writer vs Git refs). Implement short mutation guard and separate durable long-running physical workspace claim; support non-Task Spec Writer claim. A workflow attempt is **not** the claim. | Plans 01–02, T03 |
| E3.T06 — Owner/recovery protocol | Persist claim identity/ownership/evidence, provide `inspect`, evidence-based `reconcile`, compare-and-set owner release, and explicit escalation/takeover constraints. Exit of short CLI PID or expired TTL is not proof writer stopped. Dirty Engine-owned scaffold is action-scope evidence, not global bypass. | T05 |
| E3.T07 — Actor and human gates | Define practical MVP local trust boundary, accurate limitations of shared OS account and trusted human decision channel. External agent with writer claim cannot spoof approval via `--role` or prompt. Scope human evidence by spec/task/step/attempt/gate. | T03, T06 |
| E3.T08 — CLI and external skill | Add capability-owned `workflow inspect/start/finish/reconcile` CLI operations with stable machine-readable errors, success stdout and diagnostic stderr. Update the owning agent workflow skill/instructions *only after CLI commands exist*; no Runtime dependency or fake Session creation. | T03–T07 |
| E3.T09 — Runtime read projection | Expose real external workflow status/blocked claim through existing Specs read projections, honoring scoped auth and unavailable source. No automatic Session, artificial provider history or background queue. | T08 |
| E3.T10 — Process/restart tests | Spawn independent OS processes with coordination barriers, crash points, writer handoff, proof-based recovery, wrong token, changed definition during active attempt, gate mismatch, explicit finish gap, dirty baseline and two worktrees. | T03–T09 |

## Decisions and boundaries

- Pin attempts to workflow definition **revision**, not Project Home HEAD; changed definition cannot silently reinterpret an active attempt (W10).
- Trusted executor identity for admission comes from the selected local trust model or authenticated Runtime, never prompt-supplied `sessionId` or `role`. Shared OS account cannot promise strong isolation: mark limitation explicitly.
- Read-only must be technically enforced to skip writer claims. Git/ref mutations additionally use repository/project coordination independent of workspace writer.
- `terminal Turn != terminal Task`; this plan has no managed Turn, so a claim release does not infer workflow completion.
- Workflow CLI is offline and tests run with **Runtime absent**. It is not a client for the Runtime server.

## Mandatory Foundation B gate

Pass **FB01–FB09**: L03–L06, W01–W10, H07, SC01–SC02 and AG01–AG03, against actual local files and independent processes. Verify especially:
- real deterministic start/finish; finish never starts another step implicitly (W01/W02);
- Spec Writer writer claim before any Task and technically-enforced read-only without writer (W03/W04);
- proven settle unblocks, ambiguous external writer produces actionable recovery and does not auto-steal (W07/W08);
- no agent-forged human review; pinned workflow definition v1 survives/refuses v2 as appropriate (W09/W10);
- Runtime projection is observable without a managed Session (H07).

**Not in this plan:** full legacy workflow catalogue, Task Planner agents, source-control PR merge/finalize automation, provider-native sessions, GUI workflow editor, automatic next-review Session.

## Sources and handoff

- [Execution scopes/recovery](../execution-scopes-and-recovery.md), [locking](../locking-and-admission.md), [offline CLI and agents](../offline-cli-and-external-agents.md), [durable operations](../durable-operations-and-recovery.md), [local actors](../local-actor-and-human-gates.md), [legacy migration map](../legacy-nevo-migration.md).
- [Deterministic workflow architecture](../../../architecture/workflow/deterministic-workflow.md), [invariants](../../../architecture/principles/enforceable-invariants.md), [acceptance](../acceptance-criteria.md).

**Ready for Plan 05:** Engine owns a genuinely testable offline coordinator. Plan 04 may proceed in parallel once the identity and source boundaries are recorded.
