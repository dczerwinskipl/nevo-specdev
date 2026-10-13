---
id: ideas.specflow-engine.multi-instance-plan.task-02
type: engineering
title: 'M2 — Capture input and enforce effect-scoped admission'
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

# M2 — Capture input and enforce effect-scoped admission

**Idea-stage only.** Not authorized within E1–E5 and not a formal specification. The Engine must not treat `review` or `P1` as built-in workflow primitives.

## Prerequisites

M1 and accepted Engine effect-scoped workspace admission.

## Required implementation / outcome

Define post-activation input capture for same-input steps, plus optional independent-input semantics. Validate read-only capability rather than label; separate short control-plane locks, long workspace writer claims and repository/external effects. Decide scheduling/isolation for write-producing steps. Specify when inspect/verify/finalize gates may write and whether execution is preflight, per-instance in isolation or once during finalization.

## Verification and negative cases

Demonstrate activation modifies metadata before snapshot; SHA unchanged with dirty source change is detected when snapshot policy applies; three real read-only CLI processes can coexist; unsupported writable provider is rejected or safely serialized; a test gate generating artifacts never silently violates enforced read-only policy.

## Review / handoff

Solo independent architecture/code review gate for **this implementation task** (not a product workflow step type). Record actual test commands and PASS/FAIL/SKIP, source SHA, unresolved capabilities and downstream contract impact. Do not substitute a mock or agent narration for a required physical test.

References: [plan](../README.md), [multi-instance idea](../../multi-instance-execution.md), [test plan](../../test-plan.md).
