---
id: ideas.specflow-engine.plan-04.task-03
type: engineering
title: 'E4.T03 — Durable Runtime state'
status: draft
scope: specflow
areas: [runtime, ai, security, testing]
tags: [execution-task, temporary, implementation]
read_when:
  - implementing E4.T03 on the shared implementation branch
  - checking dependencies, batch safety and acceptance evidence
summary: >
  Temporary task for durable runtime state within the SpecFlow Engine implementation.
related:
  - ideas.specflow-engine.plan-04
  - ideas.specflow-engine.execution-plans
  - ideas.specflow-engine.test-plan
---

# E4.T03 — Durable Runtime state

**Temporary implementation task.** Work on branch `feature/specflow-engine-foundation`; do not create a per-task PR or treat this document as a formal Specification. The [plan overview](../README.md) owns the acceptance boundary.

## Required implementation / outcome

Implement versioned Runtime-owned Session/Turn/Work repository under approved local state home. One non-terminal active Turn per Session, idempotent logical turn starts, terminal immutability, bounded recovery records and ordered work. Do not persist duplicate Engine workflow position.

## Prerequisites

- [E4.T02](T02-canonical-identities.md)

Original planning dependency: T02. The linked IDs above are the **executable** dependency graph; a separate spec-level gate still applies.

## Execution & batching

- Mode: **Parallel candidate** `4-session-internals`; only after the shared contract has been accepted.
- Reason: Parallel with T04 only after T02 contract sign-off and nonoverlapping files/ports.
- **No concurrent writes** to the same shared manifest, registry, journal, Git ref, auth/DTO contract or Runtime feature composition without explicit coordinated ownership; dependency-free alone does not imply safe parallel execution.
- In a batch, execute tasks **in order** with a checkpoint after each and stop on unexpected contract changes. This is not simultaneous execution.

## Verification evidence to attach to review

- Specific evidence: **S01; Turn/Work persistence and replay**. These IDs refer to the [canonical candidate test matrix](../../../test-plan.md); where evidence is qualitative, provide precise inspected source/contract and build/import checks instead of inventing a PASS result.
- Show positive behavior and at least one meaningful failure/no-side-effect case for the changed boundary. Run relevant existing tests; report OS/Git/Node versions for actual Git/process cases.
- Report modified modules, new/changed contracts, tests run (PASS/FAIL/SKIP), unresolved risk and any changes that affect later task dependencies.
- Do not claim this task or its parent plan complete while required checks are skipped or unresolved security/lifecycle ownership remains.

## References

- [Parent execution plan](../README.md)
- [Program sequencing / parallel safety](../../README.md)
- [Ideas acceptance gates](../../../acceptance-criteria.md)
- [Ideas test plan](../../../test-plan.md)
