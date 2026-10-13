---
id: ideas.specflow-engine.multi-instance-plan.task-03
type: engineering
title: 'M3 — Persist typed instance contributions via offline Engine'
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

# M3 — Persist typed instance contributions via offline Engine

**Idea-stage only.** Not authorized within E1–E5 and not a formal specification. The Engine must not treat `review` or `P1` as built-in workflow primitives.

## Prerequisites

M1/M2, accepted local trust model and chosen agent-facing submit/finish semantics.

## Required implementation / outcome

Accept arbitrary step-declared typed outputs (not fixed review verdict/findings) and optional feedback/artifacts with stable instance/run identity, effective definition/instructions revision, source correlation and observed provenance. Use one Engine operation from offline CLI, MCP and managed Runtime; preserve originals and fence stale runs. Keep provider error separate from schema-valid contribution.

## Verification and negative cases

Two instances submit concurrently, duplicate replay after crash, forged instance/session/run identities, late retry response, invalid output schema, results with different user-defined shapes. No partial submission directly transitions the step.

## Review / handoff

Solo independent architecture/code review gate for **this implementation task** (not a product workflow step type). Record actual test commands and PASS/FAIL/SKIP, source SHA, unresolved capabilities and downstream contract impact. Do not substitute a mock or agent narration for a required physical test.

References: [plan](../README.md), [multi-instance idea](../../multi-instance-execution.md), [test plan](../../test-plan.md).
