---
id: ideas.specflow-engine.plan-02.task-02
type: engineering
title: "E2.T02 — Git capability"
status: draft
scope: specflow
areas: [workflow, cli, runtime, testing]
tags: [execution-task, temporary, implementation]
read_when:
  - implementing E2.T02 on the shared implementation branch
  - checking dependencies, batch safety and acceptance evidence
summary: >
  Temporary task for git capability within the SpecFlow Engine implementation.
related:
  - ideas.specflow-engine.plan-02
  - ideas.specflow-engine.execution-plans
  - ideas.specflow-engine.test-plan
---

# E2.T02 — Git capability

**Temporary implementation task.** Work on branch `feature/specflow-engine-foundation`; do not create a per-task PR or treat this document as a formal Specification. The [plan overview](../README.md) owns the acceptance boundary.

## Required implementation / outcome

Add feature-owned Git enablement, checkout/worktree inspection, safe arg-array commands and validated branch/base-ref/path planning. Reject disabled capability, wrong repository, branch checked out elsewhere and symlink/path collisions before side effects.

## Prerequisites

- [E2.T01](T01-specs-model-and-repository.md)

Original planning dependency: E2.T01. The linked IDs above are the **executable** dependency graph; a separate spec-level gate still applies.

## Execution & batching

- Mode: **Solo / review gate** — separate execution and result inspection.
- Reason: Git side effects, branch/ref namespace and root safety are shared and high risk.
- **No concurrent writes** to the same shared manifest, registry, journal, Git ref, auth/DTO contract or Runtime feature composition without explicit coordinated ownership; dependency-free alone does not imply safe parallel execution.
- In a batch, execute tasks **in order** with a checkpoint after each and stop on unexpected contract changes. This is not simultaneous execution.

## Verification evidence to attach to review

- Specific evidence: **C02/C03/C12**. These IDs refer to the [canonical candidate test matrix](../../../test-plan.md); where evidence is qualitative, provide precise inspected source/contract and build/import checks instead of inventing a PASS result.
- Show positive behavior and at least one meaningful failure/no-side-effect case for the changed boundary. Run relevant existing tests; report OS/Git/Node versions for actual Git/process cases.
- Report modified modules, new/changed contracts, tests run (PASS/FAIL/SKIP), unresolved risk and any changes that affect later task dependencies.
- Do not claim this task or its parent plan complete while required checks are skipped or unresolved security/lifecycle ownership remains.

## References

- [Parent execution plan](../README.md)
- [Program sequencing / parallel safety](../../README.md)
- [Ideas acceptance gates](../../../acceptance-criteria.md)
- [Ideas test plan](../../../test-plan.md)
