---
id: adr.0005-repository-tooling-is-separate-from-the-product-api
type: adr
title: Repository tooling is separate from the product API
status: current
date: 2026-09-06
summary: >
  Repository-internal developer tooling lives under `tools/*` as private, unscoped
  packages and never becomes a Nevo SpecDev product surface by default. Product
  capabilities are designed as `@nevo/*` packages and `nevo-spec` commands in their own
  right.
related:
  - architecture.repository-structure
  - development.cli.node-tooling-guidelines
---

# 0005 — Repository tooling is separate from the product API

## Status

Current.

## Context

The repository needs its own developer tooling — documentation discovery and ADR
authoring (`tools/docs`), release-line and version management (`tools/release`). Some of
this overlaps conceptually with things Nevo SpecDev may eventually offer as product
features (spec/decision management, a project-knowledge CLI).

Without a rule, the internal tools drift into becoming a de-facto product contract:
example commands leak into product docs, an internal package name squats on the `@nevo/*`
scope, and a refactor of a repo tool turns into a breaking product change.

## Decision

- **Location.** Repository-internal tooling lives under `tools/*`. Product code lives in
  `apps/*` and `packages/*`. There is no root `src/` — every source file has an owner.
- **Naming.** Internal tools are **private** (`"private": true`) and **unscoped**
  (`nevo-repo-docs`, `nevo-repo-release`). The `@nevo/*` scope is reserved for
  published product packages.
- **No implicit promotion.** An internal tool does not become a `nevo-spec` subcommand
  or a `@nevo/*` API just because it exists. If a capability should be a product
  surface, that is its own decision, designed independently; it may reuse extracted
  code, but the product contract is defined on its own terms.
- **Docs boundary.** `docs/development/**` may reference the internal tools freely.
  `docs/product/**` describes the product surface only; it does not present an internal
  tool's commands as an end-user contract.

## Consequences

- Internal tooling can be refactored, renamed or removed without a product-compatibility
  concern.
- The `@nevo/*` scope stays clean for real product packages.
- When ADR/decision management or documentation discovery is deliberately made a product
  feature, it gets its own ADR and design rather than inheriting the shape of the
  repo tool.
