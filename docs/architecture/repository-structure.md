---
id: architecture.repository-structure
type: architecture
title: Repository structure
status: current
read_when:
  - orienting to the repository layout
  - understanding how Turborepo and CI decide what runs
  - understanding the versioning and release-line model
  - reasoning about pre-1.0 compatibility
summary: >
  Monorepo layout (apps/packages/tools), the Turborepo task graph, the CI
  affected-package model and what invalidates everything, the SemVer / release-line
  model, and the pre-1.0 policy.
related:
  - development.local-setup
  - development.git-workflow
  - adr.0002-toolchain-selection
  - adr.0003-branch-and-release-model
---

# Repository structure

## Layout

```text
nevo-specdev/
  apps/                 deployable apps (cli, dashboard) — populated during migration
  packages/             shared / publishable libraries — populated during migration
  tools/                repository-internal tooling (never published)
    docs/               nevo-docs — documentation discovery + index
  docs/                 this documentation set
  scripts/github/       idempotent GitHub governance apply/verify scripts
  .github/              workflows, templates, CODEOWNERS, Dependabot
  turbo.json            task graph
  pnpm-workspace.yaml   apps/* packages/* tools/*
```

The workspace root is `private: true`. Child packages may become publishable later; no
fake product packages exist to pad the monorepo.

## Task graph (Turborepo)

Turborepo owns package-level task orchestration. Tasks: `build`, `typecheck`, `test`
(and `dev`, non-cached, persistent). All depend on `^build` (dependencies build
first). Outputs (`dist/**`, `coverage/**`, `*.tsbuildinfo`) are declared so caching is
correct.

Lint is **not** a Turborepo task: one ESLint flat config covers the whole repository,
so `pnpm lint` runs `eslint .` in a single pass — like formatting, it does not use
affected filtering.

Cross-package execution order comes from **declared workspace dependencies**, not a
hard-coded list. A shared package must declare its dependents correctly for affected
execution to include them.

## CI and affected packages

On pull requests, CI runs package tasks with Turborepo's `--affected` so only changed
packages **and their dependents** run:

```text
packages/core changed
  → test/build core
  → test/build every package that depends on core
  → unrelated packages are skipped
```

Affected detection needs real Git history for the PR base and head — CI checks out with
enough history (not a shallow clone) and passes the base ref through Turborepo's SCM
environment variables. When affected calculation is uncertain, CI fails safe by running
**more**, not fewer, checks.

**Global invalidation.** Changing a root input intentionally invalidates every
package's cache: `pnpm-lock.yaml`, and the files in `turbo.json#globalDependencies`
(`tsconfig.base.json`, `.prettierrc.json`, `.prettierignore`, `.editorconfig`,
`.npmrc`, `.nvmrc`). Repository-wide checks that don't map to a single package
(formatting, lint) run over the whole repo regardless of affected status.

Required CI checks are named stably — `PR title / validate`, `CI / quality`,
`CI / test`, `CI / build` — and a check still reports success when affected filtering
skipped its inner work, so a PR is never left permanently pending. Inspect what a
change would run with `pnpm exec turbo run build test typecheck --affected --dry`.

## Versioning and release lines

SemVer. One product version concept (Nevo SpecDev); internal packages are not
independently versioned yet.

- **`main`** is always the _next development version_, expressed as a prerelease:
  `1.4.0-alpha.<build>` or `2.0.0-alpha.<build>`. The build identifier is derived
  deterministically in CI (GitHub run number, optionally plus commit identity). The
  build number is **not** committed on every change; durable version-line metadata
  lives in the repository and CI derives the build version from it.
- **`release/vX.Y`** — one long-lived branch per maintained minor line. It owns the
  whole `X.Y.z` patch series. Tags (`vX.Y.0-rc.1`, `vX.Y.0`, `vX.Y.1`) are cut from
  that branch, never from an arbitrary `main` commit.
- **Cutting a line** is a manually-triggered workflow with explicit inputs — the
  release line (e.g. `1.3.0`) and the next development version (`1.4.0` **or**
  `2.0.0`). GitHub does not infer minor-vs-major; that choice is semantic and stated
  by a human. The workflow validates SemVer, checks the branch does not exist, creates
  `release/vX.Y` from the right `main` commit, sets each branch's version state, and
  moves `main` to the chosen next alpha line via PRs — never a direct write to
  protected `main`.

See ADR [`0003-branch-and-release-model`](decisions/0003-branch-and-release-model.md)
and [git-workflow](../development/git-workflow.md).

## 0.x policy

Before `1.0.0`, SemVer permits breaking changes with weaker compatibility guarantees.
This project uses that latitude pragmatically:

- Breaking changes are allowed in `0.x` without a major bump, but must be
  **intentional**, **marked** (`!` / `BREAKING CHANGE:` in the PR title/body), and
  **documented** in the PR and any affected docs/ADR.
- `main` still carries a prerelease identifier (`0.y.0-alpha.<build>`).
- Release lines (`release/v0.y`) may be cut once there is something worth maintaining
  separately from `main`; until then, `main` is the only line.
