---
id: ideas.specflow-engine.multi-instance-plan.task-01
type: engineering
title: 'M1 — Freeze step-instance identities and completion semantics'
status: draft
scope: specflow
areas: [workflow, runtime, ai, cli, testing]
tags: [future-task, multi-instance, review, deferred]
read_when:
  - implementing the deferred deterministic multi-instance execution plan
  - reviewing evidence for one stage of multi-review orchestration
summary: >
  Deferred implementation task for freeze step-instance identities and completion semantics.
related:
  - ideas.specflow-engine.multi-instance-plan
  - ideas.specflow-engine.multi-instance
  - ideas.specflow-engine.test-plan
---

# M1 — Freeze step-instance identities and completion semantics

**Status: idea-stage, not authorized for implementation in E1–E5.** This file is an independent future implementation task, not a formal Specification. Reconcile with actual source and approved decisions before executing.

## Prerequisites

Accepted E3 Workflow Kernel and an owner decision about contextual `finish` versus a separate instance submit.

## Required outcome

Define one `(spec, task, step, attempt)` with N stable instances, separate run/Turn/Session identities, pinned definition and completion policy, and precise single-instance compatibility. Do not infer cardinality from scheduler concurrency or Session count.

## Verification and negative cases

Unit tests for default single-instance, N=3 sequential versus concurrent, duplicate start, stale policy revision and zero extra workflow attempts. Invalid identity must fail closed.

## Review / handoff

Run as a **solo review gate**. Record concrete source revision, test evidence, cases intentionally unsupported, owner decisions and consequences for downstream tasks. Do not infer successful execution from a mock-only or skipped provider test. Stop rather than silently redefining workflow attempt semantics.

References: [future plan](../README.md), [multi-instance idea](../../multi-instance-execution.md), [candidate test matrix](../../test-plan.md).
