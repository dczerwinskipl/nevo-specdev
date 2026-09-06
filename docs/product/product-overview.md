---
id: product.product-overview
type: product
title: Product overview
status: draft
read_when:
  - orienting to what Nevo SpecDev is
  - deciding whether a concern belongs to the CLI or the Dashboard
summary: >
  Nevo SpecDev is a human-led, spec-anchored workflow for AI-assisted software
  engineering, delivered as a CLI (nevo-spec), a dashboard, and a shared library.
related:
  - product.shared.terminology
  - product.cli.interaction-model
  - product.dashboard.interaction-model
---

# Product overview

`status: draft` — states intent and scope; the surfaces themselves are not yet in this
repository.

## What it is

**Nevo SpecDev** is a framework and toolset for **spec-driven, AI-assisted
development**:

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
- It is **vendor-neutral**. The workflow is exposed to AI coding agents through thin
  adapters over one source of truth, rather than being tied to any single tool.

## Surfaces

| Surface       | Command / entry | Role                                                                                                            |
| ------------- | --------------- | --------------------------------------------------------------------------------------------------------------- |
| **CLI**       | `nevo-spec`     | Deterministic driver for the spec/task lifecycle and docs discovery, for humans and agents in a terminal or CI. |
| **Dashboard** | web UI          | View of active/archived specifications, tasks, changes/PRs, and AI sessions.                                    |
| **Library**   | `import`        | Shared spec model and workflow logic the surfaces build on.                                                     |

Published product packages use the `@nevo/*` scope (e.g. `@nevo/specdev`).

The end-user command is deliberately short — `nevo-spec init`, `nevo-spec status`,
`nevo-spec dashboard`. `nevo-specdev` is the repository/product name, not the binary.

## Names

| Name           | Meaning                                           |
| -------------- | ------------------------------------------------- |
| Nevo SpecDev   | the product.                                      |
| `nevo-specdev` | the repository, and the `@nevo/*` package family. |
| `nevo-spec`    | the end-user CLI command.                         |
