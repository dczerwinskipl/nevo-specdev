---
id: ideas.specflow-engine.multi-instance-plan.task-04
type: engineering
title: 'M4 — Dispatch user-defined instances and recover individual runs'
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

# M4 — Dispatch user-defined instances and recover individual runs

**Idea-stage only.** Not authorized within E1–E5 and not a formal specification. The Engine must not treat `review` or `P1` as built-in workflow primitives.

## Prerequisites

M3 and **M5** Engine-side offline aggregation/finalization complete; accepted E4 Sessions and E5 handshake.

## Required implementation / outcome

Use Runtime only for provider-neutral scheduling, Session/Turn lifecycle, per-run timeout/retry and accurate provenance. Respect declared instructions and independence policy, bounded concurrency, effect admission and unknown-outcome fencing. Submit to the existing Engine M3 contract and observe M5 finalization, never implement a second reducer in Runtime.

## Verification and negative cases

Three mock invocations with one quota failure and one timeout, later independent retry, same-model separate Sessions not mislabeled semantically independent, provider unavailable/unknown and late callback. Runtime absent still allows Engine completion via CLI.

## Review / handoff

Solo independent architecture/code review gate for **this implementation task** (not a product workflow step type). Record actual test commands and PASS/FAIL/SKIP, source SHA, unresolved capabilities and downstream contract impact. Do not substitute a mock or agent narration for a required physical test.

References: [plan](../README.md), [multi-instance idea](../../multi-instance-execution.md), [test plan](../../test-plan.md).
