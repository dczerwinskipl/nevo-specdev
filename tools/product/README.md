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
    # INTERNAL workspace package it imports (@nevo/specdev-dashboard `.` + `./cli`)
    # and commander into one ESM file with a `#!/usr/bin/env node` banner and
    # NEVO_SPEC_VERSION_INJECTED defined. `@nevo/specdev`'s `build` script is
    # exactly `node ../../tools/product/dist/bin.js bundle`.

nevo-repo-product pack [--json] [--skip-build]
    # The canonical product artifact:
    #   pnpm --filter build (nevo-repo-release + @nevo/specdev-dashboard — scoped,
    #     turbo-free, never a global pre-build)
    #   -> version from `nevo-release version` (the repo's canonical model; no
    #      SemVer/channel logic is duplicated here)
    #   -> esbuild bundle into a scratch stage
    #   -> minimal package.json (real version, NO dependencies, NO scripts,
    #      engines copied verbatim from source)
    #   -> THIRD_PARTY_NOTICES.txt (verbatim license of code EMBEDDED in the bundle
    #      — commander; not build-only tools like esbuild)
    #   -> `pnpm pack` -> .artifacts/nevo-specdev-<version>.tgz
    # Every child `pnpm` runs with cwd = repo root and `--dir <target>`, so Corepack
    # uses the repository-pinned pnpm, never "latest". --json prints { name, version, tarball }.

nevo-repo-product dogfood [--json]
    # pack, then `pnpm add -g <tarball>` (pinned pnpm), then put pnpm's global bin
    # dir on PATH and smoke the REAL installed `nevo-spec` shim (not node dist/bin.js):
    # `--version` must equal the packed version, `--help` must list `dashboard`,
    # `dashboard` must print the dashboard-capability marker. Never `pnpm link`,
    # never a `file:` path, never installs from packages/specdev.
```

Root scripts `pnpm product:pack` / `pnpm dogfood:install` build this tool first
(`pnpm --filter nevo-repo-product build && …`), so they work straight after
`pnpm install --frozen-lockfile` with no prior repo build.

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

`vitest run --no-file-parallelism`: `resolveProductVersion` units, a `bundleProduct`
integration (define + shebang + self-containment), a subprocess CLI smoke, and
`fresh-state.test.ts` — deletes `dist` / `.tsbuild` / `.artifacts` and proves
`pnpm product:pack` still works and runs on the pinned pnpm. The full
pack → isolated install → run-installed-`nevo-spec`-**shim** proof lives with the
product package (`packages/specdev/test/packaging.smoke.test.ts`), sequenced after this
suite via a `nevo-repo-product#test` turbo edge.
