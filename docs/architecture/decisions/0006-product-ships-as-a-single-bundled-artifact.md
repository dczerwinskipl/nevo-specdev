---
id: adr.0006-product-ships-as-a-single-bundled-artifact
type: adr
title: The product ships as a single bundled artifact
status: current
date: 2026-09-06
summary: >
  `@nevo/specdev` is distributed as one self-contained tarball. `nevo-repo-product`
  (esbuild) bundles the `nevo-spec` entry, the internal workspace capability packages
  and `commander` into `dist/bin.js`, so the artifact installs with no registry and no
  workspace. Source package boundaries are unchanged — only the distribution is one file.
related:
  - adr.0002-toolchain-selection
  - adr.0005-repository-tooling-is-separate-from-the-product-api
  - architecture.repository-structure
  - development.product-packaging
---

# 0006 — The product ships as a single bundled artifact

## Status

Current.

## Context

`@nevo/specdev` (the public `nevo-spec` CLI) is composed from sibling workspace
packages — the first is `@nevo/specdev-dashboard`, the dashboard capability. Inside the
monorepo those resolve through `workspace:*`. Outside it — a `pnpm pack` tarball
installed from a local file or a GitHub Release, with **no registry** — a
`workspace:*` (or `file:../…`) dependency cannot resolve: the sibling package is not
published anywhere.

`npm pack` / `pnpm pack` also never include `node_modules`, so "install the deploy
folder" is not an option without `bundledDependencies`, which is brittle with pnpm's
symlinked store.

The repository's tools ([ADR 0002](0002-toolchain-selection.md)) deliberately use plain
`tsc` and **no bundler**. That guidance is about repository-internal tools. A single
distributable product that must carry internal workspace code to a machine with no
registry is a different problem.

## Decision

- **The distributable is one self-contained file.** `nevo-repo-product`
  (`tools/product`) runs **esbuild** to compile the `nevo-spec` entry, every internal
  workspace package it imports (`@nevo/specdev-dashboard` today), and `commander` into
  `packages/specdev/dist/bin.js` — an ESM file with a `#!/usr/bin/env node` banner and
  the version baked in. The packed tarball is `dist/bin.js` + a minimal `package.json`
  (real version, **no `dependencies`**, no scripts) + `README` + `LICENSE`.
- **esbuild is confined to `tools/product`** and only ever produces the product
  artifact. Repository tools stay plain `tsc`. `@nevo/specdev`'s `build` script is
  exactly `node ../../tools/product/dist/bin.js bundle`.
- **Source boundaries are real and unchanged.** `@nevo/specdev` depends on
  `@nevo/specdev-dashboard` as a genuine `workspace:*` package with a typed capability
  API (`runDashboard(): DashboardResult`). The dashboard package never imports
  Commander. Only the _distribution_ is single-artifact; the _source_ stays a real
  multi-package boundary, and CI builds/tests it as such.
- **`@nevo/specdev-dashboard` is `private: true`** — never published or installed on its
  own. It reaches users only bundled inside `@nevo/specdev`.
- **The version comes from the release model.** The bundle's `NEVO_SPEC_VERSION_INJECTED`
  and the packed `package.json` version both come from `nevo-release version`; no
  SemVer/channel logic is duplicated, and the installed artifact never reads the
  repository's `version.json`.
- **One packaging entrypoint.** `nevo-repo-product pack` is the only implementation of
  "make the product artifact"; local `pnpm product:pack`, `pnpm dogfood:install`, and
  any future CI/release job call it rather than re-implementing packing.

## Consequences

- A user installs **one** artifact (`nevo-specdev-<version>.tgz`) and `nevo-spec` works
  — no registry, no `pnpm link`, no workspace, no second package to fetch.
- There is a build step (esbuild) between "workspace" and "artifact". It is fast,
  single-purpose, pinned, and covered by tests (`bundleProduct` + an isolated
  pack → install → run smoke).
- Bundling hides genuinely missing runtime dependencies less than a normal install
  would — so the dogfood/smoke path installs the **real tarball** in isolation rather
  than trusting `pnpm --filter` inside the workspace.
- If the product later gains a dependency that must **not** be bundled (a native addon,
  something with its own `bin`), this ADR is revisited: such a dependency goes in the
  packed `dependencies` and the "no `dependencies`" rule above is relaxed for it.
- No npm publish, no registry auth, no publish workflow is added by this decision.
