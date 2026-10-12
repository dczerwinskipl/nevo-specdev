---
id: ideas.specflow-engine.multi-instance-plan.task-02
type: engineering
title: 'M2 — Freeze reviewed material and enforce read-only execution'
status: draft
scope: specflow
areas: [workflow, runtime, ai, cli, testing]
tags: [future-task, multi-instance, review, deferred]
read_when:
  - implementing the deferred deterministic multi-instance execution plan
  - reviewing evidence for one stage of multi-review orchestration
summary: >
  Deferred implementation task for freeze reviewed material and enforce read-only execution.
related:
  - ideas.specflow-engine.multi-instance-plan
  - ideas.specflow-engine.multi-instance
  - ideas.specflow-engine.test-plan
---

# M2 — Freeze reviewed material and enforce read-only execution

**Status: idea-stage, not authorized for implementation in E1–E5.** This file is an independent future implementation task, not a formal Specification. Reconcile with actual source and approved decisions before executing.

## Prerequisites

M1 contracts and E3 physical admission/Workspace resolution.

## Required outcome

Specify one verifiable code/spec/definition snapshot for the whole group; choose a strategy covering dirty worktrees and Git HEAD drift. Prove control-plane writes are permitted without granting reviewer filesystem write capabilities. Prevent conflicting writers/rebind/cleanup from making review evidence stale.

## Verification and negative cases

Real Git worktrees and OS processes: three readers admitted; writer denied or invalidates group according to adopted policy; same SHA with changed uncommitted file rejected; native provider without enforced read-only is not misclassified.

## Review / handoff

Run as a **solo review gate**. Record concrete source revision, test evidence, cases intentionally unsupported, owner decisions and consequences for downstream tasks. Do not infer successful execution from a mock-only or skipped provider test. Stop rather than silently redefining workflow attempt semantics.

References: [future plan](../README.md), [multi-instance idea](../../multi-instance-execution.md), [candidate test matrix](../../test-plan.md).
