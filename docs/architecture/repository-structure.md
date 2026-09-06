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
  apps/                 deployable applications        (workspace glob; empty until one lands)
  packages/             product packages (@nevo/* scope)
    specdev/            @nevo/specdev            — the `nevo-spec` CLI shell + command composition
    specdev-dashboard/  @nevo/specdev-dashboard  — dashboard vertical: capability (.) + CLI adapter (./cli); private, bundled into specdev
  tools/                repository-internal tooling — never published, all TypeScript
    docs/               nevo-repo-docs    — doc discovery, index, ADR authoring
    release/            nevo-repo-release — version model, cut-release-line, promote, release
    github/             nevo-repo-github  — idempotent GitHub governance apply/verify (gh API)
    product/            nevo-repo-product — the canonical bundle + pack + dogfood entrypoint
  docs/                 this documentation set
  version.json          { channel, version } for the current branch
  .artifacts/           generated product tarballs (git-ignored)
  .github/              workflows, composite setup action, PR template, Dependabot
  turbo.json            task graph
  pnpm-workspace.yaml   workspace globs + pnpm project settings
```

The workspace root is `private: true`. `apps/` and `packages/` are workspace globs;
directories appear there with real code, not placeholders. Repository-internal tooling
lives under `tools/` (unscoped, `private`) and is never confused with a publishable
`@nevo/*` package ([ADR 0005](decisions/0005-repository-tooling-is-separate-from-the-product-api.md)).

The first product boundary is real. `@nevo/specdev` owns the `nevo-spec` **shell** —
root program, `--version`, global flags/output/exit conventions — and **composes**
top-level commands. Each capability vertical owns its own command: `@nevo/specdev-dashboard`
(`private: true`) exposes the framework-independent capability at `.` and its Commander
adapter at `./cli` (`createDashboardCommand`), and is bundled into `@nevo/specdev` at
pack time, so a user installs one artifact with no registry
([ADR 0006](decisions/0006-product-ships-as-a-single-bundled-artifact.md),
[product packaging](../development/product-packaging.md)). `dashboard` is a bootstrap
proof only — it does not start the migrated dashboard yet.

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

SemVer, with `semver` doing the parsing/compare. One product version concept (Nevo
SpecDev). Each branch carries `version.json` = `{ channel, version }`, and CI enforces
that any change to it is a legal transition (see
[releasing](../development/releasing.md)).

- **`main`** is the _next development version_: `channel: alpha`, `version` = the next
  `X.Y.0`. CI publishes `<version>-alpha.<run-number>`; the run number is a build
  identifier, not committed per change.
- **`release/vX.Y`** — one long-lived branch per maintained minor line. Its `channel`
  moves `beta` → `rc` → `stable`; after a `stable` tag it automatically advances to the
  next patch's `beta` (via PR), so no commit keeps reporting an already-shipped
  version. CI publishes `<version>-<channel>.<run>`, or the plain `<version>` while
  briefly on `stable`.
- **Public tags** are cut only from a `release/vX.Y` branch whose HEAD has passed CI,
  never from a `main` commit. Prereleases are an **intentional sequence**
  (`v1.3.0-beta.1`, `-beta.2`, `-rc.1`, `v1.3.0`, `v1.3.1`, …) computed from existing
  tags — not the build number. Tagging is recovery-safe (a re-run finishes a missing
  GitHub Release; a tag that moved is refused).
- **Cutting a line** is a manually-triggered workflow taking the release version and
  the next development version (next minor **or** next major — never inferred). It cuts
  from the current `origin/main` with the branch's `version.json` committed, and moves
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
