---
id: ideas.specflow-engine.multi-instance-plan
type: hub
title: Deferred multi-instance execution implementation plan
status: draft
scope: specflow
areas: [workflow, runtime, ai, cli, testing]
tags: [future-plan, multi-instance, deterministic, deferred, review]
read_when:
  - planning follow-up work after Engine and managed execution integration
  - reviewing task dependencies and proof required for multi-agent review
summary: >
  Future implementation plan with independent tasks to add evidence-producing instances
  under a single deterministic workflow step, without expanding the E1-E5 foundation.
related:
  - ideas.specflow-engine
  - ideas.specflow-engine.multi-instance
  - ideas.specflow-engine.execution-plans
  - ideas.specflow-engine.test-plan
---

# Future plan — deterministic multi-instance execution

**Deferred proposal, not an active E6 implementation commitment.** Start only after relevant Foundation B, Sessions Foundation and Managed Execution gates are accepted. The implementation branch may be separate; do not add this plan to the current 49 disposable E1–E5 execution files, and do not delete it with their `execution-plans/` directory. The number **06** is a sequencing suggestion, not a frozen identifier.

## Outcome and boundaries

Demonstrate three independent read-only reviewers evaluating **the same Task step/attempt and frozen source**, with stable instance IDs, bounded independent retries, separately persisted evidence, one deterministic resolution and at most one workflow transition. Both an offline CLI and a Runtime-managed provider flow must use one Engine decision path; Runtime manages provider dispatch only. Single-instance workflow and existing task batch remain behaviorally compatible.

Do not implement general parallel-write workflows, provider fleet scheduling, prompt-driven majority vote, automatic semantic deduplication or changing Worktree Registry to create a checkout per reviewer.

## Execution order and task granularity

| Task | Dependencies | Suggested mode | Proof focus |
| --- | --- | --- | --- |
| [M1 — Identity and completion semantics](tasks/T01-execution-contracts.md) | Accepted E3 workflow kernel, owner decision A/B | Solo | One step attempt / N instances / unique runs and policy revision |
| [M2 — Frozen review input and read-only admission](tasks/T02-review-snapshot-and-admission.md) | M1, E3 coordination/workspaces | Solo | Same material, no source writes, no writer-claim starvation |
| [M3 — Durable contribution store and offline CLI](tasks/T03-result-submission.md) | M1, M2 | Solo | Trusted per-instance result, idempotency, late-run fencing, offline restart |
| [M4 — Managed dispatch, retry and recovery](tasks/T04-managed-orchestration.md) | M2, M3, accepted E4/E5 | Solo | Three managed Sessions/Turns, independent retry and unknown dispatch |
| [M5 — Aggregate/finalize and owner intervention](tasks/T05-aggregation-and-waivers.md) | M3, M4 | Solo | Deterministic typed resolution, durable single transition, audited waiver |
| [M6 — Cross-process/provider-parity acceptance](tasks/T06-end-to-end-proof.md) | M1–M5 | Solo | Mixed failures, frozen evidence, single-instance regression, restart |

Review every task independently because this is canonical state/lock/authorization work. **No implicit parallel implementation** on shared workflow, registry, journal, provider scheduler or Git refs. Multiple reviewers exercising the implemented product may run concurrently in tests; that is different from dispatching implementation tasks concurrently.

## Proposed acceptance checkpoints (not Foundation gates)

- Instance cardinality is distinct from scheduler concurrency; a sequential run of three instances is equivalent to a concurrent one for completion.
- Agent-visible context and skill can submit a per-instance result without consuming the entire workflow step; only one aggregate finalization changes canonical task state.
- Three validated results from one identical input snapshot yield the configured result; one unresponsive provider remains incomplete without losing other evidence.
- Retry retains the logical slot but generates a new execution/run identity; stale submissions cannot create an extra vote.
- Truly read-only workers do not take long-lived writer claims; control-plane submissions remain transactionally serialized; external source modification or rebind does not silently pass.
- Recovery after each durable submission/finalization stage neither duplicates provider effects nor causes two transitions.
- Operator waiver/reassignment is authorized and auditable; a quorum waiver is not a separate human code-approval gate.
- Legacy one-reviewer `start/finish`, batch-of-tasks semantics and offline CLI do not regress.

## Owner decisions required before implementation

Select the agent-facing submit/finish boundary, supported instance-count policy, default aggregation semantics and findings schema, source snapshot method, enforced read-only support per adapter, provider retry/fencing policy, and operator waiver authorization. See [idea decision list](../multi-instance-execution.md) and [decision register](../decisions-and-promotion.md).

## Plan retention

This is a durable **ideas-stage follow-up plan**. When promoted into an implementation-ready specification, migrate its tasks and mark this plan superseded; do not treat temporary E1–E5 tasks as reusable normative specs.
