---
id: ideas.specflow-engine.plan-04.task-02
type: engineering
title: 'E4.T02 — Canonical identities'
status: draft
scope: specflow
areas: [runtime, ai, security, testing]
tags: [execution-task, temporary, implementation]
read_when:
  - implementing E4.T02 on the shared implementation branch
  - checking dependencies, batch safety and acceptance evidence
summary: >
  Temporary task for canonical identities within the SpecFlow Engine implementation.
related:
  - ideas.specflow-engine.plan-04
  - ideas.specflow-engine.execution-plans
  - ideas.specflow-engine.test-plan
---

# E4.T02 — Canonical identities

**Temporary implementation task.** Work on branch `feature/specflow-engine-foundation`; do not create a per-task PR or treat this document as a formal Specification. The [plan overview](../README.md) owns the acceptance boundary.

## Required implementation / outcome

Define stable product `sessionId`, `turnId`, `workId`, `interactionId` and separate provider native `ProviderSessionRef=(provider, providerSessionId)`; preserve existing normative adapter meaning until the new owned-ID contract is deliberately adopted. Do **not** derive Session from Task, workspace path or providerSessionId alone.

**Future compatibility only:** Keep product Session/Turn identities independent of `(spec, task, step, attempt)` and do not assume one Turn per workflow attempt. Stable step-instance/run identities are deferred to the [future plan](../../../multi-instance-plan/README.md).

## Prerequisites

- [E4.T01](T01-session-contract-reconnaissance.md)

Original planning dependency: T01. The linked IDs above are the **executable** dependency graph; a separate spec-level gate still applies.

## Execution & batching

- Mode: **Solo / review gate** — separate execution and result inspection.
- Reason: Stable product ID and provider reference contract; review before storage/provider work.
- **No concurrent writes** to the same shared manifest, registry, journal, Git ref, auth/DTO contract or Runtime feature composition without explicit coordinated ownership; dependency-free alone does not imply safe parallel execution.
- In a batch, execute tasks **in order** with a checkpoint after each and stop on unexpected contract changes. This is not simultaneous execution.

## Verification evidence to attach to review

- Specific evidence: **S01/SI01; identifier uniqueness**. These IDs refer to the [canonical candidate test matrix](../../../test-plan.md); where evidence is qualitative, provide precise inspected source/contract and build/import checks instead of inventing a PASS result.
- Show positive behavior and at least one meaningful failure/no-side-effect case for the changed boundary. Run relevant existing tests; report OS/Git/Node versions for actual Git/process cases.
- Report modified modules, new/changed contracts, tests run (PASS/FAIL/SKIP), unresolved risk and any changes that affect later task dependencies.
- Do not claim this task or its parent plan complete while required checks are skipped or unresolved security/lifecycle ownership remains.

## References

- [Parent execution plan](../README.md)
- [Program sequencing / parallel safety](../../README.md)
- [Ideas acceptance gates](../../../acceptance-criteria.md)
- [Ideas test plan](../../../test-plan.md)
