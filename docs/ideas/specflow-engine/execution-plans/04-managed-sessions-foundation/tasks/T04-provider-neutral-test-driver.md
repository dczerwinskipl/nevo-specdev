---
id: ideas.specflow-engine.plan-04.task-04
type: engineering
title: "E4.T04 — Provider-neutral test driver"
status: draft
scope: specflow
areas: [runtime, ai, security, testing]
tags: [execution-task, temporary, implementation]
read_when:
  - implementing E4.T04 on the shared implementation branch
  - checking dependencies, batch safety and acceptance evidence
summary: >
  Temporary task for provider-neutral test driver within the SpecFlow Engine implementation.
related:
  - ideas.specflow-engine.plan-04
  - ideas.specflow-engine.execution-plans
  - ideas.specflow-engine.test-plan
---

# E4.T04 — Provider-neutral test driver

**Temporary implementation task.** Work on branch `feature/specflow-engine-foundation`; do not create a per-task PR or treat this document as a formal Specification. The [plan overview](../README.md) owns the acceptance boundary.

## Required implementation / outcome

Introduce a controllable local mock provider/adapter that emits deterministic commentary, work, tools, interaction requests, success/failure/cancel and simulated late events. It should support synthetic provider IDs without claiming real provider parity.

## Prerequisites

- [E4.T02](T02-canonical-identities.md)

Dependency decision: T03 (Runtime storage) and T04 (provider-neutral test driver) can run in parallel **only after** T02 freezes their shared identity and port contracts. The earlier draft's T03 prerequisite is intentionally superseded by this bounded parallel split; if implementation needs shared files, execute sequentially.

## Execution & batching

- Mode: **Parallel candidate** `4-session-internals`; only after the shared contract has been accepted.
- Reason: Parallel with T03 only after T02 contract sign-off; mock adapter cannot own storage/API models.
- **No concurrent writes** to the same shared manifest, registry, journal, Git ref, auth/DTO contract or Runtime feature composition without explicit coordinated ownership; dependency-free alone does not imply safe parallel execution.
- In a batch, execute tasks **in order** with a checkpoint after each and stop on unexpected contract changes. This is not simultaneous execution.

## Verification evidence to attach to review

- Specific evidence: **S01; deterministic tool/late-event behavior**. These IDs refer to the [canonical candidate test matrix](../../../test-plan.md); where evidence is qualitative, provide precise inspected source/contract and build/import checks instead of inventing a PASS result.
- Show positive behavior and at least one meaningful failure/no-side-effect case for the changed boundary. Run relevant existing tests; report OS/Git/Node versions for actual Git/process cases.
- Report modified modules, new/changed contracts, tests run (PASS/FAIL/SKIP), unresolved risk and any changes that affect later task dependencies.
- Do not claim this task or its parent plan complete while required checks are skipped or unresolved security/lifecycle ownership remains.

## References

- [Parent execution plan](../README.md)
- [Program sequencing / parallel safety](../../README.md)
- [Ideas acceptance gates](../../../acceptance-criteria.md)
- [Ideas test plan](../../../test-plan.md)
