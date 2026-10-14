---
id: ideas.specflow-engine.plan-03.task-09
type: engineering
title: 'E3.T09 — Runtime read projection'
status: draft
scope: specflow
areas: [workflow, cli, security, testing]
tags: [execution-task, temporary, implementation]
read_when:
  - implementing E3.T09 on the shared implementation branch
  - checking dependencies, batch safety and acceptance evidence
summary: >
  Temporary task for runtime read projection within the SpecFlow Engine implementation.
related:
  - ideas.specflow-engine.plan-03
  - ideas.specflow-engine.execution-plans
  - ideas.specflow-engine.test-plan
---

# E3.T09 — Runtime read projection

**Temporary implementation task.** Work on branch `feature/specflow-engine-foundation`; do not create a per-task PR or treat this document as a formal Specification. The [plan overview](../README.md) owns the acceptance boundary.

## Required implementation / outcome

Expose real external workflow status/blocked claim through existing Specs read projections, honoring scoped auth and unavailable source. No automatic Session, artificial provider history or background queue.

## Prerequisites

- [E3.T08](T08-cli-and-external-skill.md)

Original planning dependency: T08. The linked IDs above are the **executable** dependency graph; a separate spec-level gate still applies.

## Execution & batching

- Mode: **Sequential batch** `3-adapters`; the predecessor task must complete first.
- Reason: After CLI in same batch; projection must not create fake Session state.
- **No concurrent writes** to the same shared manifest, registry, journal, Git ref, auth/DTO contract or Runtime feature composition without explicit coordinated ownership; dependency-free alone does not imply safe parallel execution.
- In a batch, execute tasks **in order** with a checkpoint after each and stop on unexpected contract changes. This is not simultaneous execution.

## Verification evidence to attach to review

- Specific evidence: **H07**. These IDs refer to the [canonical candidate test matrix](../../../test-plan.md); where evidence is qualitative, provide precise inspected source/contract and build/import checks instead of inventing a PASS result.
- Show positive behavior and at least one meaningful failure/no-side-effect case for the changed boundary. Run relevant existing tests; report OS/Git/Node versions for actual Git/process cases.
- Report modified modules, new/changed contracts, tests run (PASS/FAIL/SKIP), unresolved risk and any changes that affect later task dependencies.
- Do not claim this task or its parent plan complete while required checks are skipped or unresolved security/lifecycle ownership remains.

## References

- [Parent execution plan](../README.md)
- [Program sequencing / parallel safety](../../README.md)
- [Ideas acceptance gates](../../../acceptance-criteria.md)
- [Ideas test plan](../../../test-plan.md)
