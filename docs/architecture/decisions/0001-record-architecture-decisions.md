---
id: adr.0001-record-architecture-decisions
type: adr
title: Record architecture decisions
status: current
date: 2026-09-05
summary: >
  Durable, cross-cutting decisions are recorded as lightweight numbered Markdown ADRs
  under docs/architecture/decisions/.
---

# 0001 — Record architecture decisions

## Status

Current.

## Context

Nevo SpecDev is a public repository that will grow, take contributors, and be worked on
by coding agents. Decisions that constrain the whole repository (toolchain, license,
branch model) need to be discoverable with their rationale, so they are not silently
re-litigated or reversed.

Lightweight numbered Markdown ADRs kept in-repo are a well-established pattern for
exactly this — low ceremony, reviewed like any other change, and discoverable next to
the code they govern.

## Decision

Record durable, cross-cutting decisions as ADRs:

- One decision per file, `docs/architecture/decisions/NNNN-kebab-title.md`.
- Frontmatter `type: adr` with `id`, `title`, `status`, `date`.
- Sections: Status, Context, Decision, Consequences.
- Statuses: `current`, `superseded` (points to the replacement), `deprecated`.
- A superseded ADR is kept, not deleted.
- Template: `docs/templates/adr-template.md`.

Not every choice needs an ADR — only ones that would be expensive or confusing to
reverse without a record.

## Consequences

- Cross-cutting decisions have a single, indexed home with rationale.
- `pnpm docs:check` validates ADR frontmatter like any other doc.
- Contributors and agents can find "why is it this way" via `pnpm docs:find`.
