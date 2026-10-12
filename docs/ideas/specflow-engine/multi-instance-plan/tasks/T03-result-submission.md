---
id: ideas.specflow-engine.multi-instance-plan.task-03
type: engineering
title: 'M3 — Persist instance contributions through one Engine contract'
status: draft
scope: specflow
areas: [workflow, runtime, ai, cli, testing]
tags: [future-task, multi-instance, review, deferred]
read_when:
  - implementing the deferred deterministic multi-instance execution plan
  - reviewing evidence for one stage of multi-review orchestration
summary: >
  Deferred implementation task for persist instance contributions through one engine contract.
related:
  - ideas.specflow-engine.multi-instance-plan
  - ideas.specflow-engine.multi-instance
  - ideas.specflow-engine.test-plan
---

# M3 — Persist instance contributions through one Engine contract

**Status: idea-stage, not authorized for implementation in E1–E5.** This file is an independent future implementation task, not a formal Specification. Reconcile with actual source and approved decisions before executing.

## Prerequisites

M1–M2, selected agent-facing submit API and local trust model.

## Required outcome

Store one immutable accepted contribution per slot/run with typed verdict, structured findings, feedback, artifacts, provenance and reviewed snapshot. Offline CLI/MCP and Runtime call the same Engine operation; idempotent retries return previously accepted evidence and stale run tokens cannot overwrite.

## Verification and negative cases

Concurrent CLI submissions, two starts of same instance, crash after persisted result but before response, forged Session/instance ID, late superseded run. No workflow transition or tracked report commit from partial submit.

## Review / handoff

Run as a **solo review gate**. Record concrete source revision, test evidence, cases intentionally unsupported, owner decisions and consequences for downstream tasks. Do not infer successful execution from a mock-only or skipped provider test. Stop rather than silently redefining workflow attempt semantics.

References: [future plan](../README.md), [multi-instance idea](../../multi-instance-execution.md), [candidate test matrix](../../test-plan.md).
