---
id: ideas.specflow-engine.plan-02.task-15
type: engineering
title: 'E2.T15 — Specification closure and future workflow seam'
status: draft
scope: specflow
areas: [workflow, cli, runtime, testing]
tags: [execution-task, temporary, lifecycle-closure]
read_when:
  - implementing or reviewing E2.T15
summary: >
  Temporary Plan 02 task: Specification closure and future workflow seam.
related:
  - ideas.specflow-engine.plan-02
  - ideas.specflow-engine.specification-worktree-closure
  - ideas.specflow-engine.test-plan
---

# E2.T15 — Specification closure and future workflow seam

**Temporary task, documentation only.** Branch feature/specflow-engine-foundation / existing PR #53. No product implementation exists merely because this plan is present. This file must be removed with the entire temporary execution-plans tree before PR merge.

## Executable prerequisites

- E2.T10 accepted
- E2.T12 accepted
- E2.T13 accepted
- E2.T14 accepted
- Explicit owner approval of DC08

Run mode: **SOLO / independent domain review**. No parallel writes to shared Git refs, registry schemas, journal/state files, authentication capability lists or runtime composition. Re-check HEAD and approved decisions DC01–DC12 before editing code.

## Modules and ownership

Engine: specs/lifecycle/close-specification.ts and lifecycle/specification-exit-policy.ts. A SMALL typed workflow-facing contract only; no Task/Attempt, plugin registry, dependency injection framework or legacy tools import.

## Required behavior / exact acceptance

1. One specification-close intent contains policy decision, potential gate/action evidence, archive, scoped commit and if linked integration/rebind/disposal. Primary directly archives and commits only. Linked source archives/commits BEFORE verified primary integration. Never call the public worktree-close operation as a suboperation.
2. Today absent spec-workflow evaluator: only explicitly authorized/acknowledged manual-foundation archive with durable gateDisposition=not-evaluated-manual. It is NOT gate pass or workflow completion. Existing scaffold workflow.mode=deterministic does not magically prove readiness.
3. Reserve a minimal typed interface for future evaluateSpecificationExitGates and executeSpecificationExitActions: unavailable vs passed-with-evidence vs blocked/unknown, pinned workflow definition revision and action intent/effect evidence. An installed but failed/unknown integration must block BEFORE archive; future actions execute before archive commit, replay only if idempotency or reconciliation evidence exists.
4. Validate already-closed repeat by verified canonical archive and matching journal/identity; a conflicting close with new ID must not create another commit. Do not inspect tasks: unknown[] or infer from status.

## Required evidence

- Positive: primary and linked archive through same Engine use case with original specId and exactly one archive in verified primary
- Negative/no unintended effects: absent acknowledgement, explicit blocked/unknown gate, partially executed action, already archived but contradictory journal, crash after source archive or archive commit never pass as completed
- Report LC test IDs, test files, OS/Node/Git version for real filesystem/process work, PASS/FAIL/SKIP, modified public contracts, and an independent code-quality/recovery review. Mock-only tests do not satisfy Git/process cases.
- Checkpoint for this task: Independent review of manual-mode authorization semantics and future workflow capability without speculative implementation.
- Preserve completed E2.T01–T08; avoid unrelated refactors. No Plan 03 or Session dependency.

## Sources

- [Plan 02](../README.md)
- [Close architecture](../../../specification-and-worktree-close-design.md)
- [Decisions needing approval](../../../specification-close-decisions.md)
- [Lifecycle test matrix](../../../test-plan.md)
