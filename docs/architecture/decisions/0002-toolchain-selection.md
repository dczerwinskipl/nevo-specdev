---
id: adr.0002-toolchain-selection
type: adr
title: Toolchain selection
status: current
date: 2026-09-05
summary: >
  The monorepo foundation is pnpm + Turborepo + TypeScript + ESLint flat config +
  Prettier + Vitest on Node Active LTS, with versions pinned intentionally and
  TypeScript held one minor line back for lint-ecosystem compatibility.
related:
  - architecture.repository-structure
  - development.local-setup
---

# 0002 — Toolchain selection

## Status

Current.

## Context

The repository is a public TypeScript/JavaScript monorepo. It needs a build/test/lint
toolchain that is current, stable, and proportionate — no bespoke infrastructure where
a standard tool exists — running on a supported Node LTS. Versions are chosen once here
and pinned so future upgrades are deliberate.

At selection time the newest published TypeScript is a major line ahead of what the
current `typescript-eslint` supports, so a fully-latest set would break type-aware
linting.

## Decision

| Tool              | Pinned                                         | Rationale                                                                                                                                                                             |
| ----------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js           | `.nvmrc` `24.20.0`; `engines` `>=22.13.0`      | Node 24 is the current Active LTS. The floor is 22.13 (ESLint 10's minimum) so 22.13+ users are not locked out.                                                                       |
| pnpm              | `12.3.4` via `packageManager` + Corepack       | Latest stable. Corepack makes the pin reproducible with no global install.                                                                                                            |
| Turborepo         | `2.10.12`                                      | Latest stable; native `--affected` execution.                                                                                                                                         |
| TypeScript        | `6.0.3`                                        | One minor line back — the current `typescript-eslint` (`8.69.0`) supports `<6.1.0`. Moving to the next TS line is a separate, deliberate upgrade once the lint ecosystem supports it. |
| ESLint            | `10.10.0` + `@eslint/js` `10.0.1`, flat config | Latest stable.                                                                                                                                                                        |
| typescript-eslint | `8.69.0`                                       | Latest stable; supports ESLint 10.                                                                                                                                                    |
| Prettier          | `3.9.6` + `eslint-config-prettier` `10.1.8`    | Latest stable; formatting stays entirely in Prettier, disabled in ESLint.                                                                                                             |
| Vitest            | `5.0.0`                                        | Test runner for packages that need one (currently `tools/docs`).                                                                                                                      |

Turborepo owns the package task graph (`turbo.json`). The root scripts — `build`,
`test`, `lint`, `typecheck`, `format`, `format:check`, `check` — are the stable
contributor interface. `.npmrc` sets `engine-strict=true` and `save-exact=true`, so
dependency additions are pinned and show up as reviewable diffs.

## Consequences

- The repository targets Node 24 locally and in CI. A developer on Node below 22.13
  upgrades; a bundled Corepack too old to fetch pnpm 12 is updated with
  `npm i -g corepack@latest`.
- TypeScript sits one minor line behind the newest release on purpose. Revisit when
  `typescript-eslint` publishes support for the next TS line; the outcome is an update
  here or a superseding ADR.
- `save-exact` keeps Dependabot version-bump PRs individually reviewable.
