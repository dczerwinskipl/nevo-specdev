---
id: docs.readme
type: hub
title: Nevo SpecDev documentation
status: current
summary: >
  Top-level, human-authored map of the documentation, split by audience:
  development (how we build), product (what we build), architecture (durable decisions).
---

# Nevo SpecDev documentation

Nevo SpecDev is an early-stage, spec-driven development framework for AI-assisted
software engineering. This repository is being bootstrapped **before** the product
implementation is migrated, so these documents describe conventions and intent, not
shipped features.

For a flat, auto-generated listing of every indexed document, see
[`index.generated.md`](index.generated.md) — rebuilt by `pnpm docs:check --write`, do
not edit it by hand.

## By audience

| Area                             | You are here to learn…                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| [`development/`](development/)   | How to build in this repository — Git workflow, tooling, testing, UI implementation. |
| [`product/`](product/)           | What Nevo SpecDev is meant to do — personas, interaction models, terminology, i18n.  |
| [`architecture/`](architecture/) | Durable technical boundaries and decision records (ADRs).                            |

## Separation of concerns

- A rule about **how a React component composes classes** is a development doc
  (`development/ui/react/`).
- A rule about **what the user sees while an AI turn waits for a tool** is a product
  doc (`product/dashboard/ai-session-ux.md`).
- A **decision that constrains the whole repository** is an ADR
  (`architecture/decisions/`).

## Finding a document

```bash
pnpm docs:list                     # everything, by id
pnpm docs:find "git workflow"      # rank by query
pnpm docs:context "react tailwind" # the files to load for a task
```

## Contributing to the docs

Every indexed file carries YAML frontmatter (`id`, `type`, `title`, `status`,
`read_when`, `summary`, optional `related`). Templates live in
[`templates/`](templates/). `pnpm docs:check` validates the frontmatter and the
generated index in CI.
