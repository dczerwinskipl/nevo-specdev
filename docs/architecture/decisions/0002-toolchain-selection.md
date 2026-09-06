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

| Tool                       | Pinned                                                               | Rationale                                                                                                                                                                                                                                    |
| -------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js                    | `.nvmrc` `24.20.0`; `engines.node` `>=24.20.0 <25`                   | Node 24 LTS is the single contributor runtime — CI tests only it. The range is bounded below `25` so a newer major cannot silently satisfy `engines` before it has been adopted deliberately.                                                |
| pnpm                       | `10.34.5` via `packageManager` + Corepack; `engines.pnpm` `>=10 <11` | Newest pnpm line whose lockfile GitHub Dependency Graph / Dependabot can parse (see Context).                                                                                                                                                |
| Turborepo                  | `2.10.12`                                                            | Latest stable; native `--affected` execution.                                                                                                                                                                                                |
| TypeScript                 | `6.0.3`                                                              | Newest release inside `typescript-eslint` 8.69's supported range (`<6.1.0`).                                                                                                                                                                 |
| ESLint / typescript-eslint | `10.10.0` / `8.69.0`, flat config                                    | Latest stable. Type-aware config (`recommendedTypeChecked` + `stylisticTypeChecked`, project service) applies to `**/*.{ts,mts,cts,tsx}` — every `tools/*` package's `src` **and** `test`. Config `.mjs` files use the non-type-aware rules. |
| Prettier                   | `3.9.6` + `eslint-config-prettier` `10.1.8`                          | Formatting stays entirely in Prettier, disabled in ESLint.                                                                                                                                                                                   |
| Vitest                     | `5.0.0`                                                              | The test runner for every `tools/*` package. `tsc` emits each tool to `dist/`; the `bin` points at the built artifact.                                                                                                                       |
| Commander                  | `15.0.0`                                                             | The CLI framework for the `tools/*` executables and the pattern for the future `nevo-spec` product CLI — see [CLI architecture](../../development/cli/).                                                                                     |

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
- The `tools/*` packages are TypeScript (strict, `tsc` → `dist/`, tests typechecked);
  type-aware linting is active on them. The `.mjs` config files at the root
  (`eslint.config.mjs`, `vitest`-less) stay on the non-type-aware rules.
- **Upgrade conditions**, each its own follow-up (superseding note or ADR):
  - pnpm 11+ once `dependabot/dependabot-core#14794` (multi-document lockfile parsing)
    is resolved and verified against this repo's Dependency Graph.
  - TypeScript's next line once `typescript-eslint` publishes support for it.
