---
id: ideas.specflow-engine.plan-01.task-07
type: engineering
title: "E1.T07 — Boundary and error tests"
status: draft
scope: specflow
areas: [cli, runtime, configuration, workflow]
tags: [execution-task, temporary, implementation]
read_when:
  - implementing E1.T07 on the shared implementation branch
  - checking dependencies, batch safety and acceptance evidence
summary: >
  Temporary task for boundary and error tests within the SpecFlow Engine implementation.
related:
  - ideas.specflow-engine.plan-01
  - ideas.specflow-engine.execution-plans
  - ideas.specflow-engine.test-plan
---

# E1.T07 — Boundary and error tests

**Temporary implementation task.** Work on branch `feature/specflow-engine-foundation`; do not create a per-task PR or treat this document as a formal Specification. The [plan overview](../README.md) owns the acceptance boundary.

## Required implementation / outcome

Add real temporary Git repos, linked worktree, separate CLI processes, ambiguous/missing Project Home, invalid explicit locator, independent clone, corrupt state, path substitution, Windows/POSIX platform evidence and import-graph/packaging tests.

## Prerequisites

- [E1.T03](T03-project-home-resolver.md)
- [E1.T04](T04-workspace-registry.md)
- [E1.T05](T05-shared-coordination-primitives.md)
- [E1.T06](T06-cli-runtime-composition.md)

Original planning dependency: T03–T06. The linked IDs above are the **executable** dependency graph; a separate spec-level gate still applies.

## Execution & batching

- Mode: **Solo / review gate** — separate execution and result inspection.
- Reason: Independent cross-process/platform gate; do not self-certify with mocks only.
- **No concurrent writes** to the same shared manifest, registry, journal, Git ref, auth/DTO contract or Runtime feature composition without explicit coordinated ownership; dependency-free alone does not imply safe parallel execution.
- In a batch, execute tasks **in order** with a checkpoint after each and stop on unexpected contract changes. This is not simultaneous execution.

## Verification evidence to attach to review

- Specific evidence: **P01–P06/L01/L02/L07/C10/C11/C12**. These IDs refer to the [canonical candidate test matrix](../../../test-plan.md); where evidence is qualitative, provide precise inspected source/contract and build/import checks instead of inventing a PASS result.
- Show positive behavior and at least one meaningful failure/no-side-effect case for the changed boundary. Run relevant existing tests; report OS/Git/Node versions for actual Git/process cases.
- Report modified modules, new/changed contracts, tests run (PASS/FAIL/SKIP), unresolved risk and any changes that affect later task dependencies.
- Do not claim this task or its parent plan complete while required checks are skipped or unresolved security/lifecycle ownership remains.

## References

- [Parent execution plan](../README.md)
- [Program sequencing / parallel safety](../../README.md)
- [Ideas acceptance gates](../../../acceptance-criteria.md)
- [Ideas test plan](../../../test-plan.md)
