---
id: product.shared.terminology
type: product
title: Terminology
status: draft
read_when:
  - naming a concept in the CLI or Dashboard
  - writing user-facing copy or documentation
  - reviewing whether two surfaces describe the same thing consistently
summary: >
  Canonical product nouns for Nevo SpecDev — specification, change, task, review,
  session, work — with their meaning. Both surfaces use these terms; the message
  catalog keys follow them.
related:
  - product.product-overview
  - product.shared.localization
---

# Terminology

`status: draft` — seeded from the upstream Nevo workflow vocabulary. Extended as the
product model is migrated. When a term here has a precise meaning, do not use a synonym
in the UI or copy.

| Term                     | Meaning                                                                                                                                                                    |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Specification** (spec) | The anchoring document for a change: goal, decisions, constraints, and its task breakdown.                                                                                 |
| **Change**               | A unit of work with an identifier and a classification (see below). Owns one specification.                                                                                |
| **Change class**         | Weight of a change: **S** small, **T** standard, **A** architectural, **E** exploratory. Heavier classes require more specification and explicit owner approval.           |
| **Task**                 | A reviewable step within a change. Has a lifecycle status (draft → approved → in-implementation → implemented → verified).                                                 |
| **Review**               | The readiness assessment of a spec or a task before it advances. Produces a discrete outcome, not prose.                                                                   |
| **Approval / gate**      | A deterministic check plus an explicit owner confirmation that lets a task or spec move to the next state.                                                                 |
| **Session**              | An AI working session against a change/task, with a provider-neutral lifecycle.                                                                                            |
| **Turn**                 | One request/response cycle within a session (the user or system prompts; the agent responds, possibly using tools).                                                        |
| **Work**                 | The structured record of what an agent did within a turn — tools run, files touched — shown at progressive levels of detail (summary → expanded → inspection → technical). |
| **Commentary**           | Prose the agent produces alongside Work (narration, reasoning summaries) — distinct from Work rows.                                                                        |
| **Finalize**             | The gated step that merges a change's PR and archives its specification once every task is verified.                                                                       |
| **Forward-port**         | Applying a fix made on a maintained `release/vX.Y` line onto `main` and other maintained lines.                                                                            |

## Product name vs. command

- **Nevo SpecDev** — the product.
- **`nevo-specdev`** — the repository / future product-package scope (`@nevo/specdev`).
- **`nevo-spec`** — the end-user CLI command. Not `nevo-specdev`.
