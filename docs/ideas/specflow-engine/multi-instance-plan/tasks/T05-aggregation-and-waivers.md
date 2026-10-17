---
id: ideas.specflow-engine.multi-instance-plan.task-05
type: engineering
title: 'M5 — Resolve typed outputs and finalize one step offline'
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

# M5 — Resolve typed outputs and finalize one step offline

**Idea-stage only.** Not authorized within E1–E5 and not a formal specification. The Engine must not treat `review` or `P1` as built-in workflow primitives.

## Prerequisites

M3 only; typed reducer/completion and waiver semantics approved for a user-defined step. **No dependency on M4 or managed Sessions.**

## Required implementation / outcome

Implement deterministic, versioned field/result reducers declared by the step (boolean all/any, ordered vs nominal enum, list and other supported types) and validated output-to-transition mapping. Handle missing/invalid/contradictory results fail-closed. Preserve originals and perform exactly one durable finish, declared gates and actions; waivers only if policy permits with auditable evidence. No built-in P1 or review semantics.

## Verification and negative cases

Manually submit N results through offline CLI with Runtime absent. Exercise two distinct step result schemas: all vs any boolean, severity enum with explicitly declared order vs nominal conflict, lists with original provenance; incomplete N-1, authorized waiver, two competing finalizers, crash between gate/commit/transition stages, exactly one effect.

## Review / handoff

Solo independent architecture/code review gate for **this implementation task** (not a product workflow step type). Record actual test commands and PASS/FAIL/SKIP, source SHA, unresolved capabilities and downstream contract impact. Do not substitute a mock or agent narration for a required physical test.

References: [plan](../README.md), [multi-instance idea](../../multi-instance-execution.md), [test plan](../../test-plan.md).
