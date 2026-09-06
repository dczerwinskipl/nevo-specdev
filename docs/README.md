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

The documentation is split by audience: **development** (how it is built), **product**
(what it does), **architecture** (durable decisions). Docs that describe intent ahead of
the code they govern carry `status: draft` in their frontmatter.

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

Every authored file carries YAML frontmatter (`id`, `type`, `title`, `status`,
`read_when`, `summary`, optional `related`); `docs/templates/**` and generated files
are the only exemptions. Use [`templates/`](templates/), or `pnpm docs:adr new "Title"`
for a new ADR. `pnpm docs:check` validates the whole corpus and the generated index,
and runs in CI.
