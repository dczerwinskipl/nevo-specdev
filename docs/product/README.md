---
id: docs.product-readme
type: hub
title: Product documentation
status: current
summary: >
  What Nevo SpecDev is meant to do — product overview, shared terminology and
  localization, and the CLI and Dashboard interaction models.
---

# Product documentation

What Nevo SpecDev **does** and how it should behave. Engineering rules for building it
are under [`../development/`](../development/) — keep React/Tailwind implementation
detail out of these files, and keep personas and UX contracts out of the development
files.

| Area                                    | Covers                                                             |
| --------------------------------------- | ------------------------------------------------------------------ |
| [Product overview](product-overview.md) | What the product is and who it is for.                             |
| [`shared/`](shared/)                    | Terminology and localization — concerns common to every surface.   |
| [`cli/`](cli/)                          | The `nevo-spec` command-line product: personas, interaction model. |
| [`dashboard/`](dashboard/)              | The dashboard product: personas, interaction model, AI-session UX. |

Documents here that describe behaviour ahead of the code carry `status: draft`; the
intent and constraints they state are what the implementation must satisfy.
