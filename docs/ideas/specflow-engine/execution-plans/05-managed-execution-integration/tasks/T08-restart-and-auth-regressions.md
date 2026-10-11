---
id: ideas.specflow-engine.plan-05.task-08
type: engineering
title: "E5.T08 — Restart and auth regressions"
status: draft
scope: specflow
areas: [workflow, runtime, ai, security, testing]
tags: [execution-task, temporary, implementation]
read_when:
  - implementing E5.T08 on the shared implementation branch
  - checking dependencies, batch safety and acceptance evidence
summary: >
  Temporary task for restart and auth regressions within the SpecFlow Engine implementation.
related:
  - ideas.specflow-engine.plan-05
  - ideas.specflow-engine.execution-plans
  - ideas.specflow-engine.test-plan
---

# E5.T08 — Restart and auth regressions

**Temporary implementation task.** Work on branch `feature/specflow-engine-foundation`; do not create a per-task PR or treat this document as a formal Specification. The [plan overview](../README.md) owns the acceptance boundary.

## Required implementation / outcome

Cross-process and Runtime restart scenarios, duplicate request IDs, stale callbacks, uncertain provider outcome, wrong owner, per-Spec auth, unauthorized Session/Task reference redaction, manual recovery visibility. Test with real Git files where relevant and controlled mock provider.

## Prerequisites

- [E5.T02](T02-preparation-and-authorization.md)
- [E5.T03](T03-atomic-enough-intent-protocol.md)
- [E5.T04](T04-mock-dispatch-phases.md)
- [E5.T05](T05-turn-claim-settlement.md)
- [E5.T06](T06-explicit-workflow-interaction.md)
- [E5.T07](T07-bounded-batch-and-handover.md)

Original planning dependency: T02–T07. The linked IDs above are the **executable** dependency graph; a separate spec-level gate still applies.

## Execution & batching

- Mode: **Solo / review gate** — separate execution and result inspection.
- Reason: Independent end-to-end crash, auth and restart verification gate.
- **No concurrent writes** to the same shared manifest, registry, journal, Git ref, auth/DTO contract or Runtime feature composition without explicit coordinated ownership; dependency-free alone does not imply safe parallel execution.
- In a batch, execute tasks **in order** with a checkpoint after each and stop on unexpected contract changes. This is not simultaneous execution.

## Verification evidence to attach to review

- Specific evidence: **S01–S06/S08/H09/R06**. These IDs refer to the [canonical candidate test matrix](../../../test-plan.md); where evidence is qualitative, provide precise inspected source/contract and build/import checks instead of inventing a PASS result.
- Show positive behavior and at least one meaningful failure/no-side-effect case for the changed boundary. Run relevant existing tests; report OS/Git/Node versions for actual Git/process cases.
- Report modified modules, new/changed contracts, tests run (PASS/FAIL/SKIP), unresolved risk and any changes that affect later task dependencies.
- Do not claim this task or its parent plan complete while required checks are skipped or unresolved security/lifecycle ownership remains.

## References

- [Parent execution plan](../README.md)
- [Program sequencing / parallel safety](../../README.md)
- [Ideas acceptance gates](../../../acceptance-criteria.md)
- [Ideas test plan](../../../test-plan.md)
