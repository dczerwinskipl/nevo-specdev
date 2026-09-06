# `nevo-repo-product`

Repository-internal packaging tooling for the **Nevo SpecDev product**. Private, never
published, not a `nevo-spec` surface (ADR 0005). It is the **one canonical entrypoint**
for turning the workspace into an installable product artifact — local dogfooding and any
future CI / release job call the same functions.

## Commands

TypeScript, `tsc` → `dist/`; the `nevo-repo-product` executable is `dist/bin.js`.

```bash
nevo-repo-product bundle [--entry src/bin.ts] [--outfile dist/bin.js] [--version <v>]
    # esbuild the self-contained `nevo-spec` bundle. Compiles the entry, every
    # INTERNAL workspace package it imports (@nevo/specdev-dashboard) and commander
    # into one ESM file with a `#!/usr/bin/env node` banner and
    # NEVO_SPEC_VERSION_INJECTED defined. `@nevo/specdev`'s `build` script is
    # exactly `node ../../tools/product/dist/bin.js bundle`.

nevo-repo-product pack [--json] [--skip-build]
    # The canonical product artifact:
    #   pnpm --filter build (nevo-repo-release + @nevo/specdev-dashboard — scoped,
    #     turbo-free, never a global pre-build)
    #   -> version from `nevo-release version` (the repo's canonical model; no
    #      SemVer/channel logic is duplicated here)
    #   -> esbuild bundle into a scratch stage
    #   -> minimal package.json (real version, NO dependencies, NO scripts)
    #   -> `pnpm pack` -> .artifacts/nevo-specdev-<version>.tgz
    # --json prints { name, version, tarball }.

nevo-repo-product dogfood [--json]
    # pack, then `pnpm add -g <tarball>`, then smoke the installed `nevo-spec`
    # (`--version` must equal the packed version, `--help` must list `dashboard`,
    # `dashboard` must print the sibling-package marker). Never `pnpm link`,
    # never a `file:` path, never installs from packages/specdev.
```

Root scripts: `pnpm product:pack` and `pnpm dogfood:install`.

## Why a bundler here

The product must install from a lone `.tgz` with **no registry and no workspace**. A
naive `@nevo/specdev-dashboard: workspace:*` dependency cannot resolve there. Bundling
the internal workspace code (and `commander`) into one file solves this with a mature,
single-purpose tool. The repository's own tools stay plain `tsc`; esbuild is confined to
this package and only touches the product distributable. The **source** boundary is
untouched — `@nevo/specdev` still depends on `@nevo/specdev-dashboard` as a real
`workspace:*` package with a typed capability API; only the shipped form is one artifact.
See [`docs/development/product-packaging.md`](../../docs/development/product-packaging.md).

## Tests

`vitest run`: `resolveProductVersion` units, a `bundleProduct` integration (define +
shebang + self-containment), and a subprocess CLI smoke. The full
pack → isolated install → run-installed-`nevo-spec` proof lives with the product package
(`packages/specdev/test/packaging.smoke.test.ts`).
