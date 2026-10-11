---
id: ideas.specflow-engine.plan-03.task-08
type: engineering
title: "E3.T08 — CLI and external skill"
status: draft
scope: specflow
areas: [workflow, cli, security, testing]
tags: [execution-task, temporary, implementation]
read_when:
  - implementing E3.T08 on the shared implementation branch
  - checking dependencies, batch safety and acceptance evidence
summary: >
  Temporary task for cli and external skill within the SpecFlow Engine implementation.
related:
  - ideas.specflow-engine.plan-03
  - ideas.specflow-engine.execution-plans
  - ideas.specflow-engine.test-plan
---

# E3.T08 — CLI and external skill

**Temporary implementation task.** Work on branch `feature/specflow-engine-foundation`; do not create a per-task PR or treat this document as a formal Specification. The [plan overview](../README.md) owns the acceptance boundary.

## Required implementation / outcome

Add capability-owned `workflow inspect/start/finish/reconcile` CLI operations with stable machine-readable errors, success stdout and diagnostic stderr. Update the owning agent workflow skill/instructions *only after CLI commands exist*; no Runtime dependency or fake Session creation.

## Prerequisites

- [E3.T03](T03-readiness-step-state.md)
- [E3.T04](T04-verification-boundary.md)
- [E3.T05](T05-physical-admission.md)
- [E3.T06](T06-owner-recovery-protocol.md)
- [E3.T07](T07-actor-and-human-gates.md)

Original planning dependency: T03–T07. The linked IDs above are the **executable** dependency graph; a separate spec-level gate still applies.

## Execution & batching

- Mode: **Sequential batch** `3-adapters`; the predecessor task must complete first.
- Reason: Implement CLI then Runtime projection in one sequential batch after all gate contracts stabilize.
- **No concurrent writes** to the same shared manifest, registry, journal, Git ref, auth/DTO contract or Runtime feature composition without explicit coordinated ownership; dependency-free alone does not imply safe parallel execution.
- In a batch, execute tasks **in order** with a checkpoint after each and stop on unexpected contract changes. This is not simultaneous execution.

## Verification evidence to attach to review

- Specific evidence: **W01/W02 offline CLI**. These IDs refer to the [canonical candidate test matrix](../../../test-plan.md); where evidence is qualitative, provide precise inspected source/contract and build/import checks instead of inventing a PASS result.
- Show positive behavior and at least one meaningful failure/no-side-effect case for the changed boundary. Run relevant existing tests; report OS/Git/Node versions for actual Git/process cases.
- Report modified modules, new/changed contracts, tests run (PASS/FAIL/SKIP), unresolved risk and any changes that affect later task dependencies.
- Do not claim this task or its parent plan complete while required checks are skipped or unresolved security/lifecycle ownership remains.

## References

- [Parent execution plan](../README.md)
- [Program sequencing / parallel safety](../../README.md)
- [Ideas acceptance gates](../../../acceptance-criteria.md)
- [Ideas test plan](../../../test-plan.md)
