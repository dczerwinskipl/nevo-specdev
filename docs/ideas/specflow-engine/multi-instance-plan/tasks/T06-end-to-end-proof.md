---
id: ideas.specflow-engine.multi-instance-plan.task-06
type: engineering
title: 'M6 — Prove CLI and managed multi-instance compatibility'
status: draft
scope: specflow
areas: [workflow, runtime, ai, cli, testing]
tags: [future-task, multi-instance, deferred]
read_when:
  - implementing the deferred deterministic multi-instance execution plan
  - reviewing independently verifiable Engine and Runtime execution stages
summary: >
  Deferred task for the generic user-defined step execution contract and its
  separately testable instance coordination and result lifecycle.
related:
  - ideas.specflow-engine.multi-instance-plan
  - ideas.specflow-engine.multi-instance
  - ideas.specflow-engine.test-plan
---

# M6 — Prove CLI and managed multi-instance compatibility

**Idea-stage only.** Not authorized within E1–E5 and not a formal specification. The Engine must not treat `review` or `P1` as built-in workflow primitives.

## Prerequisites

M1 through M5 complete; provider effect restrictions and provenance caveats documented.

## Required implementation / outcome

Run MI01–MI12 acceptance scenarios through CLI with Runtime absent and managed Runtime mock. Verify different user-defined step names/policies and effect classes, post-activation source capture, gate ordering, no duplicate transition, independent retry/recovery, honest provenance and one-instance/legacy-batch regressions.

## Verification and negative cases

Real independent CLI processes and Git worktrees on supported platforms; crash/restart injection, sequential/concurrent comparison, provider timeouts, invalid reducer/missing evidence, no tracking of forged human acceptance. Mark missing native capabilities SKIP/unsupported, never PASS.

## Review / handoff

Solo independent architecture/code review gate for **this implementation task** (not a product workflow step type). Record actual test commands and PASS/FAIL/SKIP, source SHA, unresolved capabilities and downstream contract impact. Do not substitute a mock or agent narration for a required physical test.

References: [plan](../README.md), [multi-instance idea](../../multi-instance-execution.md), [test plan](../../test-plan.md).
