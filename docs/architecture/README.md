---
id: docs.architecture-readme
type: hub
title: Architecture documentation
status: current
summary: >
  Durable technical boundaries and decision records. Not a place for implementation
  instructions — those belong in development/.
---

# Architecture documentation

Durable technical structure and the decisions that constrain the whole repository.
Implementation how-to lives in [`../development/`](../development/); this area is for
boundaries and rationale.

| Doc                                             | Covers                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| [Repository structure](repository-structure.md) | Workspace layout, task graph, CI affected-package model, versioning, the 0.x policy. |
| [`decisions/`](decisions/)                      | Architecture Decision Records (ADRs).                                                |

## When to add an ADR

Record a decision as an ADR when it is **durable** and **cross-cutting** — it
constrains how future work is done and would be expensive or confusing to reverse
silently. Routine, local choices do not need one. See
[`decisions/README.md`](decisions/README.md).
