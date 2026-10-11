---
id: ideas.specflow-engine.plan-01.task-03
type: engineering
title: "E1.T03 — Project Home resolver"
status: draft
scope: specflow
areas: [cli, runtime, configuration, workflow]
tags: [execution-task, temporary, implementation]
read_when:
  - implementing E1.T03 on the shared implementation branch
  - checking dependencies, batch safety and acceptance evidence
summary: >
  Temporary task for project home resolver within the SpecFlow Engine implementation.
related:
  - ideas.specflow-engine.plan-01
  - ideas.specflow-engine.execution-plans
  - ideas.specflow-engine.test-plan
---

# E1.T03 — Project Home resolver

**Temporary implementation task.** Work on branch `feature/specflow-engine-foundation`; do not create a per-task PR or treat this document as a formal Specification. The [plan overview](../README.md) owns the acceptance boundary.

## Required implementation / outcome

Implement verified `cwd -> Git checkout -> common-dir -> designated home` with explicit validated override; distinguish local project identity, committed operational config at home, local ignored config, and active workspace root. Reject ambiguous, absent or substituted home.

## Prerequisites

- [E1.T01](T01-contract-baseline.md)
- [E1.T02](T02-engine-boundary.md)

Original planning dependency: T01–T02. The linked IDs above are the **executable** dependency graph; a separate spec-level gate still applies.

## Execution & batching

- Mode: **Solo / review gate** — separate execution and result inspection.
- Reason: Project Home is the authority for all later paths and policy; test independently.
- **No concurrent writes** to the same shared manifest, registry, journal, Git ref, auth/DTO contract or Runtime feature composition without explicit coordinated ownership; dependency-free alone does not imply safe parallel execution.
- In a batch, execute tasks **in order** with a checkpoint after each and stop on unexpected contract changes. This is not simultaneous execution.

## Verification evidence to attach to review

- Specific evidence: **P01/P02/P03/C10**. These IDs refer to the [canonical candidate test matrix](../../../test-plan.md); where evidence is qualitative, provide precise inspected source/contract and build/import checks instead of inventing a PASS result.
- Show positive behavior and at least one meaningful failure/no-side-effect case for the changed boundary. Run relevant existing tests; report OS/Git/Node versions for actual Git/process cases.
- Report modified modules, new/changed contracts, tests run (PASS/FAIL/SKIP), unresolved risk and any changes that affect later task dependencies.
- Do not claim this task or its parent plan complete while required checks are skipped or unresolved security/lifecycle ownership remains.

## References

- [Parent execution plan](../README.md)
- [Program sequencing / parallel safety](../../README.md)
- [Ideas acceptance gates](../../../acceptance-criteria.md)
- [Ideas test plan](../../../test-plan.md)
