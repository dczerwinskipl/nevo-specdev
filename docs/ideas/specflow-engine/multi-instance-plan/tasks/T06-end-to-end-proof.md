---
id: ideas.specflow-engine.multi-instance-plan.task-06
type: engineering
title: 'M6 — Prove offline/managed compatibility and regression'
status: draft
scope: specflow
areas: [workflow, runtime, ai, cli, testing]
tags: [future-task, multi-instance, review, deferred]
read_when:
  - implementing the deferred deterministic multi-instance execution plan
  - reviewing evidence for one stage of multi-review orchestration
summary: >
  Deferred implementation task for prove offline/managed compatibility and regression.
related:
  - ideas.specflow-engine.multi-instance-plan
  - ideas.specflow-engine.multi-instance
  - ideas.specflow-engine.test-plan
---

# M6 — Prove offline/managed compatibility and regression

**Status: idea-stage, not authorized for implementation in E1–E5.** This file is an independent future implementation task, not a formal Specification. Reconcile with actual source and approved decisions before executing.

## Prerequisites

M1–M5 and real provider read-only feasibility review.

## Required outcome

Run scenario acceptance matrix across Engine CLI, Runtime-managed mock dispatch and supported providers. Check no fixture-only success, no hidden Runtime dependency for offline submission, source consistency, recovery, authorization and surfaced Attention/read models.

## Verification and negative cases

MI01–MI12 from deferred test plan; POSIX/Windows where relevant, kill/restart processes, compare sequential/concurrent results, verify single-agent `step finish` and legacy batch-of-tasks compatibility. Record provider capability limitations as SKIP/unsupported, not PASS.

## Review / handoff

Run as a **solo review gate**. Record concrete source revision, test evidence, cases intentionally unsupported, owner decisions and consequences for downstream tasks. Do not infer successful execution from a mock-only or skipped provider test. Stop rather than silently redefining workflow attempt semantics.

References: [future plan](../README.md), [multi-instance idea](../../multi-instance-execution.md), [candidate test matrix](../../test-plan.md).
