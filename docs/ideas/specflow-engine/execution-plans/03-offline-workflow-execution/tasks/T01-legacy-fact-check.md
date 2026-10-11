---
id: ideas.specflow-engine.plan-03.task-01
type: engineering
title: "E3.T01 — Legacy fact check"
status: draft
scope: specflow
areas: [workflow, cli, security, testing]
tags: [execution-task, temporary, implementation]
read_when:
  - implementing E3.T01 on the shared implementation branch
  - checking dependencies, batch safety and acceptance evidence
summary: >
  Temporary task for legacy fact check within the SpecFlow Engine implementation.
related:
  - ideas.specflow-engine.plan-03
  - ideas.specflow-engine.execution-plans
  - ideas.specflow-engine.test-plan
---

# E3.T01 — Legacy fact check

**Temporary implementation task.** Work on branch `feature/specflow-engine-foundation`; do not create a per-task PR or treat this document as a formal Specification. The [plan overview](../README.md) owns the acceptance boundary.

## Required implementation / outcome

Inspect `dczerwinskipl/nevo` current deterministic workflow `start-operation`, `finish-operation`, `readiness-policy`, `step-context`, `operation-record`, `workspace-writer` and relevant tests. Classify port/refactor/replace/delete; do not migrate old queue or Runtime-only Session imports.

## Prerequisites

- [E2.T08](../../02-specifications-git-workspaces/tasks/T08-safety-and-regression.md)

Original planning dependency: Plans 01–02. The linked IDs above are the **executable** dependency graph; a separate spec-level gate still applies.

## Execution & batching

- Mode: **Solo / review gate** — separate execution and result inspection.
- Reason: Legacy semantic inventory is a decision gate; no eager port of queue/provider dependencies.
- **No concurrent writes** to the same shared manifest, registry, journal, Git ref, auth/DTO contract or Runtime feature composition without explicit coordinated ownership; dependency-free alone does not imply safe parallel execution.
- In a batch, execute tasks **in order** with a checkpoint after each and stop on unexpected contract changes. This is not simultaneous execution.

## Verification evidence to attach to review

- Specific evidence: **Legacy import and test evidence**. These IDs refer to the [canonical candidate test matrix](../../../test-plan.md); where evidence is qualitative, provide precise inspected source/contract and build/import checks instead of inventing a PASS result.
- Show positive behavior and at least one meaningful failure/no-side-effect case for the changed boundary. Run relevant existing tests; report OS/Git/Node versions for actual Git/process cases.
- Report modified modules, new/changed contracts, tests run (PASS/FAIL/SKIP), unresolved risk and any changes that affect later task dependencies.
- Do not claim this task or its parent plan complete while required checks are skipped or unresolved security/lifecycle ownership remains.

## References

- [Parent execution plan](../README.md)
- [Program sequencing / parallel safety](../../README.md)
- [Ideas acceptance gates](../../../acceptance-criteria.md)
- [Ideas test plan](../../../test-plan.md)
