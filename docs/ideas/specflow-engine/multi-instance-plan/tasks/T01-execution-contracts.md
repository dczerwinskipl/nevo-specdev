---
id: ideas.specflow-engine.multi-instance-plan.task-01
type: engineering
title: 'M1 — Freeze user-defined step policy and execution identities'
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

# M1 — Freeze user-defined step policy and execution identities

**Idea-stage only.** Not authorized within E1–E5 and not a formal specification. The Engine must not treat `review` or `P1` as built-in workflow primitives.

## Prerequisites

Accepted E3 Workflow Kernel; owner decision about instance submission API and typed, versioned step definition.

## Required implementation / outcome

Prove that arbitrary user-defined steps supply instructions, gates, result schema, effect policy, instance cardinality, independence requirements and deterministic resolution rules. Keep one workflow attempt with N Engine-assigned instance IDs and separate run/Session/Turn references. Define default single-instance compatibility; no special review status vocabulary.

## Verification and negative cases

At least two differently named step definitions (one review-like, one not); single-instance regression; N=3 with sequential vs concurrent admission; invalid reducer/output mappings fail closed; reconfiguring instructions after activation cannot re-interpret the active attempt.

## Review / handoff

Solo independent architecture/code review gate for **this implementation task** (not a product workflow step type). Record actual test commands and PASS/FAIL/SKIP, source SHA, unresolved capabilities and downstream contract impact. Do not substitute a mock or agent narration for a required physical test.

References: [plan](../README.md), [multi-instance idea](../../multi-instance-execution.md), [test plan](../../test-plan.md).
