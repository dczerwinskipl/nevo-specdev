---
id: ideas.specflow-engine.plan-04.task-05
type: engineering
title: 'E4.T05 — Turn coordinator'
status: draft
scope: specflow
areas: [runtime, ai, security, testing]
tags: [execution-task, temporary, implementation]
read_when:
  - implementing E4.T05 on the shared implementation branch
  - checking dependencies, batch safety and acceptance evidence
summary: >
  Temporary task for turn coordinator within the SpecFlow Engine implementation.
related:
  - ideas.specflow-engine.plan-04
  - ideas.specflow-engine.execution-plans
  - ideas.specflow-engine.test-plan
---

# E4.T05 — Turn coordinator

**Temporary implementation task.** Work on branch `feature/specflow-engine-foundation`; do not create a per-task PR or treat this document as a formal Specification. The [plan overview](../README.md) owns the acceptance boundary.

## Required implementation / outcome

Implement Runtime-owned start/observe/interact/cancel/reconcile lifecycle; an interrupted live operation becomes a truthful interrupted/unavailable/recoverable state according to evidence. Normalize provider-specific data into canonical Work, not raw events in UI.

**Future compatibility only:** The one-active-Turn rule applies to a **Session**, not to a future group of distinct Sessions reviewing one Task step. Do not start multi-instance scheduling here; see [future plan](../../../multi-instance-plan/README.md).

## Prerequisites

- [E4.T03](T03-durable-runtime-state.md)
- [E4.T04](T04-provider-neutral-test-driver.md)

Original planning dependency: T03–T04. The linked IDs above are the **executable** dependency graph; a separate spec-level gate still applies.

## Execution & batching

- Mode: **Solo / review gate** — separate execution and result inspection.
- Reason: Converges two parallel changes; coordinator owner reviews concurrent-start/recovery semantics.
- **No concurrent writes** to the same shared manifest, registry, journal, Git ref, auth/DTO contract or Runtime feature composition without explicit coordinated ownership; dependency-free alone does not imply safe parallel execution.
- In a batch, execute tasks **in order** with a checkpoint after each and stop on unexpected contract changes. This is not simultaneous execution.

## Verification evidence to attach to review

- Specific evidence: **One active Turn; idempotent start and terminal immutability**. These IDs refer to the [canonical candidate test matrix](../../../test-plan.md); where evidence is qualitative, provide precise inspected source/contract and build/import checks instead of inventing a PASS result.
- Show positive behavior and at least one meaningful failure/no-side-effect case for the changed boundary. Run relevant existing tests; report OS/Git/Node versions for actual Git/process cases.
- Report modified modules, new/changed contracts, tests run (PASS/FAIL/SKIP), unresolved risk and any changes that affect later task dependencies.
- Do not claim this task or its parent plan complete while required checks are skipped or unresolved security/lifecycle ownership remains.

## References

- [Parent execution plan](../README.md)
- [Program sequencing / parallel safety](../../README.md)
- [Ideas acceptance gates](../../../acceptance-criteria.md)
- [Ideas test plan](../../../test-plan.md)
