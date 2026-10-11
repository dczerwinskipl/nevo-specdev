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

**Lifecycle: temporary implementation plan.** This is an implementation worklist for **Foundation B**, not a normative workflow specification. Source of truth remains current [deterministic workflow architecture](../../../../architecture/workflow/deterministic-workflow.md); [PR #50 ideas](https://github.com/dczerwinskipl/nevo-specflow/pull/50) are candidate detail.

## Required observable scenario

A person launches an **external** agent in a verified checkout. Runtime can remain stopped throughout. The agent's skill calls product CLI to inspect readiness, explicitly start one real step, edit the expected workspace, inspect/check and explicitly finish the step. A fresh CLI process later resumes the same deterministic Task/attempt. Another competing writer is blocked; another independent worktree may proceed. When Runtime does run, it observes the real Engine workflow state without inventing Session/Turn history for the external agent.

There must be **one real** minimal workflow definition, one real Task and an actual transition. A fake `step start` endpoint or global in-memory lock cannot count as proof.

## Execution order, task files and review checkpoints

Each task has its own Markdown file. **Batch** means sequential tasks in one agent session; **parallel** means independent workers writing disjoint owners; **solo** means separately executed and reviewed. The task-level dependency links are executable prerequisites, not only documentation. For cross-plan ordering see the [program runbook](../../README.md).

### Recommended waves

1. T01 solo (legacy contract)
2. T02 solo (versioned workflow)
3. T03 → T04 sequential batch `3-workflow-readiness`
4. T05 solo (physical writer)
5. T06 solo (recovery)
6. T07 solo (human trust)
7. T08 → T09 sequential batch `3-adapters`
8. T10 solo (Foundation B gate)

### Tasks

| Task | Depends on | Run mode |
| --- | --- | --- |
| [E3.T01 — Legacy fact check](tasks/T01-legacy-fact-check.md) | E2.T08 | Solo |
| [E3.T02 — Workflow definition/identity](tasks/T02-workflow-definition-identity.md) | E3.T01 | Solo |
| [E3.T03 — Readiness/step state](tasks/T03-readiness-step-state.md) | E3.T02 | Sequential batch `3-workflow-readiness` |
| [E3.T04 — Verification boundary](tasks/T04-verification-boundary.md) | E3.T03 | Sequential batch `3-workflow-readiness` |
| [E3.T05 — Physical admission](tasks/T05-physical-admission.md) | E3.T03, E1.T05 | Solo |
| [E3.T06 — Owner/recovery protocol](tasks/T06-owner-recovery-protocol.md) | E3.T05 | Solo |
| [E3.T07 — Actor and human gates](tasks/T07-actor-and-human-gates.md) | E3.T03, E3.T06 | Solo |
| [E3.T08 — CLI and external skill](tasks/T08-cli-and-external-skill.md) | E3.T03, E3.T04, E3.T05, E3.T06, E3.T07 | Sequential batch `3-adapters` |
| [E3.T09 — Runtime read projection](tasks/T09-runtime-read-projection.md) | E3.T08 | Sequential batch `3-adapters` |
| [E3.T10 — Process/restart tests](tasks/T10-process-restart-tests.md) | E3.T03, E3.T04, E3.T05, E3.T06, E3.T07, E3.T08, E3.T09 | Solo |

**Batch policy:** never auto-batch a high-risk solo gate with dependent tasks; re-evaluate shared file ownership at dispatch. In particular, lock/claim, security, HTTP scopes, durability/recovery and dispatch uncertainty need an explicit review checkpoint. If a task uncovers an architecture conflict, stop dependent tasks but continue unaffected, disjoint work.

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

- [Execution scopes/recovery](../../execution-scopes-and-recovery.md), [locking](../../locking-and-admission.md), [offline CLI and agents](../../offline-cli-and-external-agents.md), [durable operations](../../durable-operations-and-recovery.md), [local actors](../../local-actor-and-human-gates.md), [legacy migration map](../../legacy-nevo-migration.md).
- [Deterministic workflow architecture](../../../../architecture/workflow/deterministic-workflow.md), [invariants](../../../../architecture/principles/enforceable-invariants.md), [acceptance](../../acceptance-criteria.md).

**Ready for Plan 05:** Engine owns a genuinely testable offline coordinator. Plan 04 may proceed in parallel once the identity and source boundaries are recorded.
