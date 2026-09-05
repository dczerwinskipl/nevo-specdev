---
id: product.product-overview
type: product
title: Product overview
status: draft
read_when:
  - orienting to what Nevo SpecDev is
  - deciding whether a concern belongs to the CLI or the Dashboard
  - understanding the current stage of the project
summary: >
  Nevo SpecDev is a human-led, spec-anchored workflow for AI-assisted software
  engineering, delivered as a CLI (nevo-spec) and a Dashboard. This repository is
  bootstrapping the foundation before that implementation is migrated.
related:
  - product.shared.terminology
  - product.cli.interaction-model
  - product.dashboard.interaction-model
---

# Product overview

`status: draft` — written before the implementation is migrated. It states intent and
scope, not shipped behavior.

## What it is

**Nevo SpecDev** is a framework and toolset for **spec-driven, AI-assisted
development**. The core idea, carried forward from the upstream Nevo project:

- The work is **human-led**. The repository owner makes architectural and scope
  decisions. AI agents propose options with a recommendation and implement approved
  work inside an explicitly declared context — they do not decide on the owner's
  behalf.
- Every non-trivial change is **anchored to a specification**. Changes are classified
  by weight (small / standard / architectural / exploratory); heavier changes get more
  specification and explicit owner approval gates.
- The workflow is **tool-enforced and deterministic**. Discovery, specification, task
  decomposition, start/verify/finalize, and documentation discovery run through
  commands that produce stable, machine-readable output — safe for agents to drive.
- It is **vendor-neutral**. The same workflow is exposed to Claude Code, Cursor,
  Copilot, and others through thin adapters over one source of truth.

## Surfaces

| Surface             | Package (future)         | Command / entry | Role                                                                                                            |
| ------------------- | ------------------------ | --------------- | --------------------------------------------------------------------------------------------------------------- |
| **CLI**             | `apps/cli`               | `nevo-spec`     | Deterministic driver for the spec/task lifecycle and docs discovery, for humans and agents in a terminal or CI. |
| **Dashboard**       | `apps/dashboard`         | web UI          | Live, file-backed view of active/archived specifications, tasks, changes/PRs, and AI sessions.                  |
| **Product package** | `packages/@nevo/specdev` | library         | Shared spec model and workflow logic the surfaces build on.                                                     |

The end-user command is deliberately short — `nevo-spec init`, `nevo-spec status`,
`nevo-spec dashboard`. `nevo-specdev` is the repository/product name, not the binary.

## Not in this repository

- The upstream Nevo product implementation, active/historical specs, provider internals,
  session runtime, and dashboard/server product code — all migrated later, in reviewable
  pieces.
- Any .NET. The upstream project is a .NET solution; only its Node/React tooling lineage
  and conventions are carried here.

## Current stage

Foundation only: workspace tooling, documentation architecture, Git/GitHub governance,
CI, versioning model, and security baseline. See [`../README.md`](../README.md) and the
repository [`README.md`](../../README.md).
