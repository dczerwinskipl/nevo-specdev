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
    docs/               nevo-repo-docs — documentation discovery + index
  docs/                 this documentation set
  scripts/github/       idempotent GitHub governance apply/verify (gh API)
  scripts/release/      version derivation, cut-release-line, release (tag + GH Release)
  version.json          { channel, version } for the current branch
  .github/              workflows, composite setup action, PR template, Dependabot
  turbo.json            task graph
  pnpm-workspace.yaml   workspace globs + pnpm project settings
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

**Global invalidation.** Turbo hashes `pnpm-lock.yaml` and root `package.json`
automatically; `turbo.json#globalDependencies` adds only `tsconfig.base.json` (extended
by every package `tsconfig`). Those are the inputs that legitimately change every
package's build/test/typecheck output. Repo-wide quality config (Prettier,
EditorConfig, ESLint) is not global — it only affects `pnpm format` / `pnpm lint`,
which run over the whole repo outside Turbo.

Required CI checks are the stably-named jobs `pr-title`, `quality`, `test` and `build`.
A check still reports success when affected filtering skipped its inner work, so a PR is
never left permanently pending. Inspect what a change would run with
`pnpm exec turbo run build test typecheck --affected --dry`.

## Versioning and release lines

SemVer. One product version concept (Nevo SpecDev); internal packages are not
independently versioned yet. Each branch carries `version.json` = `{ channel, version }`.

- **`main`** is always the _next development version_: `channel: alpha`, `version` =
  the next `X.Y.0`. CI publishes it as `<version>-alpha.<run-number>`. The run number
  is a build identifier, not committed per change.
- **`release/vX.Y`** — one long-lived branch per maintained minor line, owning the
  whole `X.Y.z` series. Its `channel` moves `beta` → `rc` → `stable` and then repeats
  for each patch; CI publishes `<version>-<channel>.<run>` (or the plain `<version>` on
  `stable`).
- **Public tags** are cut only from a `release/vX.Y` branch, never from an arbitrary
  `main` commit, and prereleases follow an **intentional sequence**
  (`v1.3.0-beta.1`, `-beta.2`, `-rc.1`, `v1.3.0`, `v1.3.1`, …) computed from existing
  tags — not from the build number.
- **Cutting a line** is a manually-triggered workflow taking the release version and
  the next development version (next minor **or** next major — never inferred). It
  creates `release/vX.Y` with its own `version.json` already committed, and moves
  `main` forward through a PR, never a direct write.

See [releasing](../development/releasing.md), ADR
[`0003-branch-and-release-model`](decisions/0003-branch-and-release-model.md), and
[git-workflow](../development/git-workflow.md).

## 0.x policy

Before `1.0.0`, SemVer permits breaking changes with weaker compatibility guarantees.
This project uses that latitude pragmatically:

- Breaking changes are allowed in `0.x` without a major bump, but must be
  **intentional**, **marked** (`!` / `BREAKING CHANGE:` in the PR title/body), and
  **documented** in the PR and any affected docs/ADR.
- `main` still carries a prerelease identifier (`0.y.0-alpha.<build>`).
- Release lines (`release/v0.y`) may be cut once there is something worth maintaining
  separately from `main`; until then, `main` is the only line.
