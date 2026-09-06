---
id: docs.architecture-decisions-readme
type: hub
title: Architecture Decision Records
status: current
summary: >
  Index of ADRs. Each ADR captures one durable, cross-cutting decision, its context,
  and its consequences.
---

# Architecture Decision Records

An ADR records a decision that is **durable** and **cross-cutting** — it shapes how
future work is done. Routine local choices do not get an ADR.

Format: [`../../templates/adr-template.md`](../../templates/adr-template.md). Files are
numbered `NNNN-kebab-title.md`. A superseded ADR keeps `status: superseded` and points
to its replacement.

| ADR                                                                 | Status  | Decision                                                                                 |
| ------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| [0001](0001-record-architecture-decisions.md)                       | current | Use lightweight numbered Markdown ADRs.                                                  |
| [0002](0002-toolchain-selection.md)                                 | current | pnpm + Turborepo + TypeScript + ESLint flat + Prettier + Vitest, on Node LTS.            |
| [0003](0003-branch-and-release-model.md)                            | current | `main` + `feature/` + `fix/` + long-lived `release/vX.Y`; squash-only merges.            |
| [0004](0004-mit-license.md)                                         | current | License the repository MIT.                                                              |
| [0005](0005-repository-tooling-is-separate-from-the-product-api.md) | current | Repo tooling under `tools/*` (private, unscoped) never implicitly becomes a product API. |
