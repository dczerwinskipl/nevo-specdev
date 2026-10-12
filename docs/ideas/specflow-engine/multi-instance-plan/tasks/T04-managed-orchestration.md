---
id: ideas.specflow-engine.multi-instance-plan.task-04
type: engineering
title: 'M4 — Schedule independent reviewers and recover each run'
status: draft
scope: specflow
areas: [workflow, runtime, ai, cli, testing]
tags: [future-task, multi-instance, review, deferred]
read_when:
  - implementing the deferred deterministic multi-instance execution plan
  - reviewing evidence for one stage of multi-review orchestration
summary: >
  Deferred implementation task for schedule independent reviewers and recover each run.
related:
  - ideas.specflow-engine.multi-instance-plan
  - ideas.specflow-engine.multi-instance
  - ideas.specflow-engine.test-plan
---

# M4 — Schedule independent reviewers and recover each run

**Status: idea-stage, not authorized for implementation in E1–E5.** This file is an independent future implementation task, not a formal Specification. Reconcile with actual source and approved decisions before executing.

## Prerequisites

M2–M3, accepted E4 Session/Turn foundation and E5 dispatch handshake.

## Required outcome

Introduce provider-neutral dispatch/read projection for N independent reviewer slots, bounded concurrency, per-run timeout/retry, idempotent invocation intent, and explicit unknown-outcome recovery. A Session/Turn can fail without consuming a slot; successful slots survive restart and retry of another slot.

## Verification and negative cases

Three mock providers, one quota error, one timeout, one successful result; retry only affected slot; unknown dispatch cannot be blindly replayed; no fourth result; terminal Turn alone is not completion.

## Review / handoff

Run as a **solo review gate**. Record concrete source revision, test evidence, cases intentionally unsupported, owner decisions and consequences for downstream tasks. Do not infer successful execution from a mock-only or skipped provider test. Stop rather than silently redefining workflow attempt semantics.

References: [future plan](../README.md), [multi-instance idea](../../multi-instance-execution.md), [candidate test matrix](../../test-plan.md).
