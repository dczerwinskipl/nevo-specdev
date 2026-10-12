---
id: ideas.specflow-engine.multi-instance-plan.task-05
type: engineering
title: 'M5 — Apply typed aggregation and final transition once'
status: draft
scope: specflow
areas: [workflow, runtime, ai, cli, testing]
tags: [future-task, multi-instance, review, deferred]
read_when:
  - implementing the deferred deterministic multi-instance execution plan
  - reviewing evidence for one stage of multi-review orchestration
summary: >
  Deferred implementation task for apply typed aggregation and final transition once.
related:
  - ideas.specflow-engine.multi-instance-plan
  - ideas.specflow-engine.multi-instance
  - ideas.specflow-engine.test-plan
---

# M5 — Apply typed aggregation and final transition once

**Status: idea-stage, not authorized for implementation in E1–E5.** This file is an independent future implementation task, not a formal Specification. Reconcile with actual source and approved decisions before executing.

## Prerequisites

M3–M4 and owner-approved completion/resolution rules.

## Required outcome

Aggregate only valid same-snapshot contributions, preserve all original findings, distinguish incomplete/technical errors from semantic fail, and finalize via one durable existing workflow transition. Permit separately authorized and auditable retry/reassignment/waiver where adopted; quorum waiver must not imply human code approval.

## Verification and negative cases

All-pass, one blocking P1 against two pass, conflicting/unknown severity, 2/3 with failure, 2/3 with approved waiver, two competing aggregate finalizers and crash after partial finalize. Never double-transition or count waived missing results as positive votes.

## Review / handoff

Run as a **solo review gate**. Record concrete source revision, test evidence, cases intentionally unsupported, owner decisions and consequences for downstream tasks. Do not infer successful execution from a mock-only or skipped provider test. Stop rather than silently redefining workflow attempt semantics.

References: [future plan](../README.md), [multi-instance idea](../../multi-instance-execution.md), [candidate test matrix](../../test-plan.md).
