---
id: ideas.specflow-engine.multi-instance-plan
type: hub
title: Deferred multi-instance execution implementation plan
status: draft
scope: specflow
areas: [workflow, runtime, ai, cli, testing]
tags: [future-plan, multi-instance, deterministic, deferred]
read_when:
  - planning user-defined step fan-out and deterministic fan-in after Engine foundation
  - reviewing dependencies for offline aggregation before managed orchestration
summary: >
  Future implementation sequence for user-defined multi-instance workflow steps: Engine
  identities, effects and contributions, offline deterministic aggregation, then managed
  provider scheduling and end-to-end recovery.
related:
  - ideas.specflow-engine
  - ideas.specflow-engine.multi-instance
  - ideas.specflow-engine.execution-plans
  - ideas.specflow-engine.test-plan
---

# Future plan — generic multi-instance execution

**Deferred proposal, not an active E6 implementation commitment.** Do not expand E1–E5, and do not place these tasks inside the disposable `execution-plans/` tree. Multi-instance is applicable to **any configured step**; a multi-agent read-only review is a useful first test case, not a special Engine workflow.

## Outcome and boundaries

Demonstrate N independent results of the *same user-defined step* with stable instance/run identity, declared effect scope, pinned instructions and input policy, offline contribution submission, deterministically configured aggregation and exactly one canonical finish. Only then connect Runtime-managed providers and concurrency limits. Keep existing one-instance workflow and multi-task batches compatible.

The initial concurrency proof may restrict instances to enforced read-only effects on a shared snapshot. This is a **supported-mode restriction**, not a built-in `review` type or a promise that arbitrary write-producing steps can safely run simultaneously.

## Execution order and task granularity

- [M1 — Definition and identities](tasks/T01-execution-contracts.md) — depends on: Accepted E3 kernel and user policy decisions; execution mode: Solo; proof: Generic step policy, pinned output schema, stable instance/run IDs.
- [M2 — Effects and input capture](tasks/T02-input-and-effect-admission.md) — depends on: M1, Engine admission/workspaces; execution mode: Solo; proof: Post-activation snapshot, gate effects, admission enforcement.
- [M3 — Contribution persistence and offline CLI](tasks/T03-result-submission.md) — depends on: M1–M2; execution mode: Solo; proof: Trusted durable per-instance results, retry and fencing.
- [M5 — Engine aggregation and finalization](tasks/T05-aggregation-and-waivers.md) — depends on: M3; execution mode: Solo; proof: Typed declared reducer, incomplete states, one finish without Runtime.
- [M4 — Managed instance orchestration](tasks/T04-managed-orchestration.md) — depends on: M3, M5, accepted E4/E5; execution mode: Solo; proof: Bounded scheduling, provenance, independent provider retries.
- [M6 — Integrated acceptance](tasks/T06-end-to-end-proof.md) — depends on: M1–M5; execution mode: Solo; proof: Sequential/concurrent parity, real-process recovery, backwards compatibility.

**Implement M5 before M4.** Engine's offline deterministic result collector must be independently testable using manually submitted contributions; Runtime Sessions must not become a hidden prerequisite of aggregation. Tasks are individually reviewed; `parallel` in the product's run policy does not authorize concurrent implementation edits in the shared repo.

## Proposed acceptance

- User-defined instructions, declared typed outputs and declared completion/aggregation rules control behavior, not the literal name `review`.
- `instances`, required valid results, semantic independence policy and `maxConcurrency` are separate validated configuration concerns.
- `step start` activates at most one step attempt; instances have stable identities and can submit separately. Only final aggregate finish changes canonical state.
- M5 reduces three offline CLI results with no Runtime and no managed Sessions; unresolved or missing data cannot silently pass.
- Effectful work is admitted according to actual capabilities. Read-only readers can coexist and emit control-plane results; sharing a worktree among independent writers is not assumed safe.
- If an identical-input policy is configured, capture input **after** step activation and verify it at each admission/submission. Verified gates that produce side effects cannot silently run concurrently.
- Retry creates a new run for the same slot; provenance distinguishes separate executions from independent judgments and prevents duplicate votes.
- After M5, M4 integrates Session/Turn dispatch, bounded concurrency and recovery without owning Engine aggregation or finish.
- A waiver changes effective completion evidence only as explicitly authorized. It never invents a result, a code approval or an undeclared workflow transition.
- Existing single-instance start/finish and legacy multiple-task batch remain unaffected.

## Open owner choices

Select A/B submission API (B preferred but undecided), supported effects and snapshot method, independence policy and observed evidence, typed reducer registry, timeout/retry rules, waiver authorization, and provider transport guarantees. Refer to the [idea](../multi-instance-execution.md) and [decision register](../decisions-and-promotion.md).

## Retention

Retain this ideas-stage plan outside E1–E5 cleanup. On formal acceptance, move tasks into an approved specification and mark this draft superseded rather than promoting temporary tasks by implication.
