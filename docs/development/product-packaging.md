---
id: development.product-packaging
type: development
title: Product packaging
status: current
read_when:
  - building or changing how the nevo-spec product is packed
  - adding a package that ships inside @nevo/specdev
  - reviewing @nevo/specdev package metadata
  - wiring a CI or release job that needs the product tarball
summary: >
  How the Nevo SpecDev product is turned into one installable artifact:
  nevo-repo-product bundles the nevo-spec entry, the internal workspace capability
  packages and commander with esbuild, then pnpm pack produces
  .artifacts/nevo-specdev-<version>.tgz. Source package boundaries stay real; only the
  distribution is a single file.
related:
  - adr.0006-product-ships-as-a-single-bundled-artifact
  - development.dogfooding
  - development.releasing
  - architecture.repository-structure
---

# Product packaging

`@nevo/specdev` (the public `nevo-spec` CLI) is distributed as **one self-contained
tarball**. See [ADR 0006](../architecture/decisions/0006-product-ships-as-a-single-bundled-artifact.md)
for why.

## Layout

| Package                                                                    | Role                                                                                                                                           |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| [`packages/specdev`](../../packages/specdev/README.md)                     | `@nevo/specdev` — the public `nevo-spec` executable (Commander router + thin `bin.ts`).                                                        |
| [`packages/specdev-dashboard`](../../packages/specdev-dashboard/README.md) | `@nevo/specdev-dashboard` — the dashboard **capability** (`runDashboard()`); `private: true`, framework-independent, bundled into the product. |
| [`tools/product`](../../tools/product/README.md)                           | `nevo-repo-product` — the **one** packaging entrypoint (`bundle` · `pack` · `dogfood`).                                                        |

The source dependency `@nevo/specdev → @nevo/specdev-dashboard` is a real `workspace:*`
edge with a typed API. The single-artifact form is only the _distribution_.

## The canonical command

```bash
pnpm product:pack        # -> .artifacts/nevo-specdev-<version>.tgz
```

`pnpm product:pack` runs `nevo-repo-product pack`, which is the only implementation of
"make the product artifact". `pnpm dogfood:install` and any future CI / release job call
the same function — there is no second pack path.

Steps:

1. **Build the inputs, scoped.** `pnpm --filter nevo-repo-release build` and
   `pnpm --filter @nevo/specdev-dashboard build` — the package's own `tsc`, never a
   global `turbo run build`, so packaging can run inside `turbo run test` and never
   triggers a repo-wide pre-build.
2. **Resolve the version** from `nevo-release version` (the same command
   `pnpm version:print` uses — the repository's canonical channel/SemVer model). It is
   validated as a legal npm version.
3. **Bundle** with esbuild (`nevo-repo-product bundle`): the `nevo-spec` entry +
   `@nevo/specdev-dashboard` + `commander`, into one ESM `dist/bin.js` with a
   `#!/usr/bin/env node` banner and `NEVO_SPEC_VERSION_INJECTED` defined.
4. **Write minimal metadata** into a scratch stage: `name`, the resolved `version`,
   `bin`, `type`, `license`, `engines`, `files: ["dist"]` — **no `dependencies`**, no
   `devDependencies`, no `scripts`.
5. **`pnpm pack`** the stage into `.artifacts/` (git-ignored). The name is deterministic:
   `nevo-specdev-<version>.tgz`.

## Package-metadata rules for `@nevo/specdev`

Even though nothing is published, the source `package.json` must stay coherent:

| Field          | Rule                                                                                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version`      | Stays `0.0.0` in source — **never hand-edited per release**. The real version is injected at pack time.                                                              |
| `bin`          | `nevo-spec` → `./dist/bin.js` (the built/bundled file, never `src`).                                                                                                 |
| `files`        | `["dist"]`. `README`/`LICENSE` are always included by pnpm. Tests, `src`, tsconfig, turbo config never ship.                                                         |
| `dependencies` | Empty in the packed manifest — `commander` and the internal capability are compiled in, so a `commander` entry lives in **`devDependencies`** of the source package. |
| `type`         | `module`.                                                                                                                                                            |
| `engines.node` | `>=24.20.0`.                                                                                                                                                         |

Verify contents before trusting a change:

```bash
pnpm product:pack
tar -tzf .artifacts/nevo-specdev-*.tgz          # expect: package/{dist/bin.js,package.json,README.md,LICENSE}
tar -xzOf .artifacts/nevo-specdev-*.tgz package/package.json
```

## What is proven, and where

| Layer               | Test                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| capability          | `packages/specdev-dashboard/test` — `runDashboard()` returns the marker.                                                                                                                                                                                                                                                                                                        |
| CLI router          | `packages/specdev/test/cli.test.ts` — `createProgram`, `--help`, `--version`, `dashboard` routing, unknown-command exit.                                                                                                                                                                                                                                                        |
| bundler             | `tools/product/test/bundle.test.ts` — esbuild injects the version, emits a runnable ESM file with the shebang, inlines a sibling module.                                                                                                                                                                                                                                        |
| **packed artifact** | `packages/specdev/test/packaging.smoke.test.ts` — `pack` → install the tarball into an **isolated prefix outside the workspace** (`--ignore-workspace`) → run the installed `nevo-spec`: `--help` (0, names the CLI + `dashboard`), `--version` (0, equals the packed version), `dashboard` (0, prints the sibling marker). Nothing resolves through the repo's `node_modules`. |

## Future GitHub Release compatibility

`Release` is **not** changed to attach the tarball in this pass. When it is, it calls
`nevo-repo-product pack` — the same entrypoint — rather than re-implementing packing.
There is still no npm publish.
