---
id: ideas.specflow-engine.plan-02.task-01
type: engineering
title: "E2.T01 — Specs model and repository"
status: draft
scope: specflow
areas: [workflow, cli, runtime, testing]
tags: [execution-task, temporary, implementation]
read_when:
  - implementing E2.T01 on the shared implementation branch
  - checking dependencies, batch safety and acceptance evidence
summary: >
  Temporary task for specs model and repository within the SpecFlow Engine implementation.
related:
  - ideas.specflow-engine.plan-02
  - ideas.specflow-engine.execution-plans
  - ideas.specflow-engine.test-plan
---

# E2.T01 — Specs model and repository

**Temporary implementation task.** Work on branch `feature/specflow-engine-foundation`; do not create a per-task PR or treat this document as a formal Specification. The [plan overview](../README.md) owns the acceptance boundary.

## Required implementation / outcome

Inspect latest current Specs and legacy `tools/specs/store.mjs`, `identity.mjs`, `validation.mjs`, `indexes.mjs`. Choose committed manifest/scaffold structure compatible with current UI read semantics. Keep stable `specId`, validated slug and no second source of canonical status.

## Prerequisites

- [E1.T07](../../01-engine-project-foundation/tasks/T07-boundary-and-error-tests.md)

Original planning dependency: Plan 01. The linked IDs above are the **executable** dependency graph; a separate spec-level gate still applies.

## Execution & batching

- Mode: **Solo / review gate** — separate execution and result inspection.
- Reason: Confirm manifest and read-model contract before Git work.
- **No concurrent writes** to the same shared manifest, registry, journal, Git ref, auth/DTO contract or Runtime feature composition without explicit coordinated ownership; dependency-free alone does not imply safe parallel execution.
- In a batch, execute tasks **in order** with a checkpoint after each and stop on unexpected contract changes. This is not simultaneous execution.

## Verification evidence to attach to review

- Specific evidence: **C04**. These IDs refer to the [canonical candidate test matrix](../../../test-plan.md); where evidence is qualitative, provide precise inspected source/contract and build/import checks instead of inventing a PASS result.
- Show positive behavior and at least one meaningful failure/no-side-effect case for the changed boundary. Run relevant existing tests; report OS/Git/Node versions for actual Git/process cases.
- Report modified modules, new/changed contracts, tests run (PASS/FAIL/SKIP), unresolved risk and any changes that affect later task dependencies.
- Do not claim this task or its parent plan complete while required checks are skipped or unresolved security/lifecycle ownership remains.

## References

- [Parent execution plan](../README.md)
- [Program sequencing / parallel safety](../../README.md)
- [Ideas acceptance gates](../../../acceptance-criteria.md)
- [Ideas test plan](../../../test-plan.md)
