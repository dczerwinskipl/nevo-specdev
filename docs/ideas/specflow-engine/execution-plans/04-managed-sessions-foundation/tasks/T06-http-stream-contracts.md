---
id: ideas.specflow-engine.plan-04.task-06
type: engineering
title: 'E4.T06 — HTTP/stream contracts'
status: draft
scope: specflow
areas: [runtime, ai, security, testing]
tags: [execution-task, temporary, implementation]
read_when:
  - implementing E4.T06 on the shared implementation branch
  - checking dependencies, batch safety and acceptance evidence
summary: >
  Temporary task for http/stream contracts within the SpecFlow Engine implementation.
related:
  - ideas.specflow-engine.plan-04
  - ideas.specflow-engine.execution-plans
  - ideas.specflow-engine.test-plan
---

# E4.T06 — HTTP/stream contracts

**Temporary implementation task.** Work on branch `feature/specflow-engine-foundation`; do not create a per-task PR or treat this document as a formal Specification. The [plan overview](../README.md) owns the acceptance boundary.

## Required implementation / outcome

Add authenticated and scoped feature-owned Session read/start/cancel/interact endpoints and streaming/replay where currently supported architecture permits. Place exact DTOs in `@nevo/specflow-contracts`, not shared UI fixtures or Engine. Separate ownership of Runtime read source from API presenter.

## Prerequisites

- [E4.T05](T05-turn-coordinator.md)

Original planning dependency: T03–T05. The linked IDs above are the **executable** dependency graph; a separate spec-level gate still applies.

## Execution & batching

- Mode: **Sequential batch** `4-runtime-surface`; the predecessor task must complete first.
- Reason: Runtime HTTP first, then T07 UI in same sequential batch, with DTO acceptance at boundary.
- **No concurrent writes** to the same shared manifest, registry, journal, Git ref, auth/DTO contract or Runtime feature composition without explicit coordinated ownership; dependency-free alone does not imply safe parallel execution.
- In a batch, execute tasks **in order** with a checkpoint after each and stop on unexpected contract changes. This is not simultaneous execution.

## Verification evidence to attach to review

- Specific evidence: **Scoped Session HTTP/cancel/interact/replay**. These IDs refer to the [canonical candidate test matrix](../../../test-plan.md); where evidence is qualitative, provide precise inspected source/contract and build/import checks instead of inventing a PASS result.
- Show positive behavior and at least one meaningful failure/no-side-effect case for the changed boundary. Run relevant existing tests; report OS/Git/Node versions for actual Git/process cases.
- Report modified modules, new/changed contracts, tests run (PASS/FAIL/SKIP), unresolved risk and any changes that affect later task dependencies.
- Do not claim this task or its parent plan complete while required checks are skipped or unresolved security/lifecycle ownership remains.

## References

- [Parent execution plan](../README.md)
- [Program sequencing / parallel safety](../../README.md)
- [Ideas acceptance gates](../../../acceptance-criteria.md)
- [Ideas test plan](../../../test-plan.md)
