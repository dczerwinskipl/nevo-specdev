---
id: adr.0002-toolchain-selection
type: adr
title: Toolchain selection
status: current
date: 2026-09-05
summary: >
  The monorepo foundation is pnpm 10 + Turborepo + TypeScript + ESLint flat config
  (type-aware for TS) + Prettier + Vitest on Node Active LTS. Two versions are held back
  on purpose — pnpm (for GitHub Dependency Graph compatibility) and TypeScript (for the
  lint ecosystem) — each with an explicit upgrade condition.
related:
  - architecture.repository-structure
  - development.local-setup
  - development.dependencies-and-security
---

# 0002 — Toolchain selection

## Status

Current.

## Context

The repository is a public TypeScript/JavaScript monorepo. It needs a build/test/lint
toolchain that is current, stable, and proportionate — no bespoke infrastructure where
a standard tool exists — on a supported Node LTS. Versions are chosen once here and
pinned so upgrades are deliberate.

Two ecosystem realities forced a version to be held back:

- **pnpm 11+ writes a multi-document `pnpm-lock.yaml`** (an "env lockfile" document
  followed by the real project document). GitHub's Dependency Graph and Dependabot read
  only the first document and therefore report the repository as having **zero
  dependencies** — which would make the security baseline hollow. Tracked in
  `dependabot/dependabot-core#14794` (open, no fix). pnpm 10 still writes a single
  document that those tools parse correctly.
- **The newest published TypeScript is a major line ahead of `typescript-eslint`'s
  support range**, so a fully-latest set breaks type-aware linting.

## Decision

| Tool                             | Pinned                                                               | Rationale                                                                                                                                                                                                                 |
| -------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js                          | `.nvmrc` `24.20.0`; `engines.node` `>=24.0.0`                        | Node 24 LTS is the single contributor runtime — CI tests only it, so the floor is not widened for a transitive dependency.                                                                                                |
| pnpm                             | `10.34.5` via `packageManager` + Corepack; `engines.pnpm` `>=10 <11` | Newest pnpm line whose lockfile GitHub Dependency Graph / Dependabot can parse (see Context).                                                                                                                             |
| Turborepo                        | `2.10.12`                                                            | Latest stable; native `--affected` execution.                                                                                                                                                                             |
| TypeScript                       | `6.0.3`                                                              | Newest release inside `typescript-eslint` 8.69's supported range (`<6.1.0`).                                                                                                                                              |
| ESLint / typescript-eslint       | `10.10.0` / `8.69.0`, flat config                                    | Latest stable. Type-aware config (`recommendedTypeChecked` + `stylisticTypeChecked`, project service) is applied to `**/*.{ts,mts,cts,tsx}`; JS/MJS scripts use the non-type-aware rules and need no tsconfig membership. |
| Prettier                         | `3.9.6` + `eslint-config-prettier` `10.1.8`                          | Formatting stays entirely in Prettier, disabled in ESLint.                                                                                                                                                                |
| Vitest (+ `@vitest/coverage-v8`) | `5.0.0`                                                              | Test runner for packages that need one (currently `tools/docs`), 80% coverage thresholds.                                                                                                                                 |

Project pnpm settings (`engineStrict`, `savePrefix: ""` for exact pins, `nodeVersion`
so resolution and `engines` checks use the pinned Node regardless of the running one)
live in **`pnpm-workspace.yaml`** — since pnpm 10, `.npmrc` is read only for
auth/registry, so the repository has no `.npmrc`.

Turborepo owns the package task graph (`turbo.json`). Root scripts — `build`, `test`,
`lint`, `typecheck`, `format`, `format:check`, `check:quality`, `check` — are the stable
contributor interface. Lint and format run repository-wide (one config each), not as
Turbo tasks.

## Consequences

- Node 24 LTS is the only supported contributor/CI runtime. A developer on a different
  Node still gets deterministic installs because `pnpm-workspace.yaml#nodeVersion`
  fixes the resolution target. Published `@nevo/*` packages can declare a broader
  runtime matrix when they exist; the private root does not.
- Exact version pins keep Dependabot bump PRs individually reviewable.
- **Type-aware linting is configured but dormant** until the first `.ts` source lands —
  there are no TypeScript sources yet.
- **Upgrade conditions**, each its own follow-up (superseding note or ADR):
  - pnpm 11+ once `dependabot/dependabot-core#14794` (multi-document lockfile parsing)
    is resolved and verified against this repo's Dependency Graph.
  - TypeScript's next line once `typescript-eslint` publishes support for it.
