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
  packages and commander with esbuild, then packs on the pinned pnpm to produce
  .artifacts/nevo-specdev-<version>.tgz (with a THIRD_PARTY_NOTICES.txt). Source
  package boundaries stay real — the shell composes, each vertical owns its CLI
  adapter — only the distribution is a single file.
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

| Package                                                                    | Role                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`packages/specdev`](../../packages/specdev/README.md)                     | `@nevo/specdev` — the CLI **shell**: the root `nevo-spec` program, `--version`, global flags/output/exit conventions, and command **composition**. Thin `bin.ts`.                                                                              |
| [`packages/specdev-dashboard`](../../packages/specdev-dashboard/README.md) | `@nevo/specdev-dashboard` — the dashboard **vertical**: the framework-independent capability at `.` (`runDashboard()`, no Commander) and its command adapter at `./cli` (`createDashboardCommand`). `private: true`, bundled into the product. |
| [`tools/product`](../../tools/product/README.md)                           | `nevo-repo-product` — the **one** packaging entrypoint (`bundle` · `pack` · `dogfood`).                                                                                                                                                        |

**Ownership.** The shell composes (`program.addCommand(createDashboardCommand(ctx))`);
it does not define a command's name, options, help or subcommands — the vertical does.
Commander is a dependency of the vertical's `./cli` subpath only, never of its
capability/runtime — the same way a feature owns its HTTP routes while the server root
only mounts them. The source dependency `@nevo/specdev → @nevo/specdev-dashboard` is a
real `workspace:*` edge; the single-artifact form is only the _distribution_.

## The canonical command

```bash
pnpm product:pack        # -> .artifacts/nevo-specdev-<version>.tgz
```

`pnpm product:pack` runs `nevo-repo-product pack`, which is the only implementation of
"make the product artifact". `pnpm dogfood:install` and any future CI / release job call
the same function — there is no second pack path.

Steps:

0. **Self-bootstrap.** The root scripts are
   `pnpm --filter nevo-repo-product build && node tools/product/dist/bin.js …`, so
   `pnpm product:pack` / `pnpm dogfood:install` work straight after
   `pnpm install --frozen-lockfile` — no prior `pnpm build` / `pnpm check`, no committed
   `dist`.
1. **Build the inputs, scoped.** `pnpm --filter nevo-repo-release build` and
   `pnpm --filter @nevo/specdev-dashboard build` — the package's own `tsc`, never a
   global `turbo run build`, so packaging can run inside `turbo run test` and never
   triggers a repo-wide pre-build.
2. **Resolve the version** from `nevo-release version` (the same command
   `pnpm version:print` uses — the repository's canonical channel/SemVer model). It is
   validated as a legal npm version.
3. **Bundle** with esbuild (`nevo-repo-product bundle`): the `nevo-spec` entry +
   `@nevo/specdev-dashboard` (`.` and `./cli`) + `commander`, into one ESM `dist/bin.js`
   with a `#!/usr/bin/env node` banner and `NEVO_SPEC_VERSION_INJECTED` defined.
4. **Write minimal metadata** into a scratch stage: `name`, the resolved `version`,
   `bin`, `type`, `license`, `engines`,
   `files: ["dist", "THIRD_PARTY_NOTICES.txt", "README.md", "LICENSE"]` — **no
   `dependencies`**, no `devDependencies`, no `scripts`.
5. **Write `THIRD_PARTY_NOTICES.txt`** — the verbatim license of every third-party
   package **embedded in the bundle** (currently `commander`), derived from that
   package's own installed `LICENSE`. Build-only tools (esbuild, tsc) are **not** listed.
6. **`pnpm pack`** the stage into `.artifacts/` (git-ignored). Every child `pnpm` — this
   pack, the input builds, the isolated install in the smoke test, the global
   `dogfood` install — runs with `cwd` = the repository root (which carries
   `packageManager`) and targets other directories with `--dir`, so Corepack always uses
   the **repository-pinned pnpm**, never "latest". The tarball name is deterministic:
   `nevo-specdev-<version>.tgz`.

## Package-metadata rules for `@nevo/specdev`

Even though nothing is published, the source `package.json` must stay coherent:

| Field          | Rule                                                                                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version`      | Stays `0.0.0` in source — **never hand-edited per release**. The real version is injected at pack time.                                                                                                       |
| `bin`          | `nevo-spec` → `./dist/bin.js` (the built/bundled file, never `src`).                                                                                                                                          |
| `files`        | Staged as `["dist", "THIRD_PARTY_NOTICES.txt", "README.md", "LICENSE"]`. Tests, `src`, tsconfig, turbo config never ship.                                                                                     |
| `dependencies` | Empty in the packed manifest. `commander` is compiled in, so it is a **`devDependency`** of the source `@nevo/specdev` (and a real `dependency` of `@nevo/specdev-dashboard`, whose `./cli` adapter uses it). |
| `type`         | `module`.                                                                                                                                                                                                     |
| `engines.node` | `>=24.20.0 <25` — kept identical to the repository root and to the only Node version CI tests. The staged manifest copies it verbatim.                                                                        |

Verify contents before trusting a change:

```bash
pnpm product:pack
tar -tzf .artifacts/nevo-specdev-*.tgz
#  package/LICENSE  package/README.md  package/THIRD_PARTY_NOTICES.txt
#  package/dist/bin.js  package/package.json      (and nothing else)
tar -xzOf .artifacts/nevo-specdev-*.tgz package/package.json
```

## What is proven, and where

| Layer               | Test                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| capability          | `packages/specdev-dashboard/test/dashboard.test.ts` — `runDashboard()` returns the marker.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| CLI adapter         | `packages/specdev-dashboard/test/command.test.ts` — `createDashboardCommand` returns a `dashboard` `Command`, its action writes the marker to the injected sink, and the capability module does **not** import Commander.                                                                                                                                                                                                                                                                                                                         |
| CLI shell           | `packages/specdev/test/cli.test.ts` — `createProgram` composes the command; `--help`, `--version`, `dashboard` routing, unknown-command exit.                                                                                                                                                                                                                                                                                                                                                                                                     |
| bundler             | `tools/product/test/bundle.test.ts` — esbuild injects the version, emits a runnable ESM file with the shebang, inlines a sibling module.                                                                                                                                                                                                                                                                                                                                                                                                          |
| fresh clone         | `tools/product/test/fresh-state.test.ts` — after deleting `tools/product/{dist,.tsbuild}` and clearing `.artifacts`, `pnpm product:pack` still produces a tarball; the effective pnpm is the pinned one.                                                                                                                                                                                                                                                                                                                                          |
| **packed artifact** | `packages/specdev/test/packaging.smoke.test.ts` — `pack` (pinned pnpm) → install the tarball into an **isolated prefix outside the workspace** (`pnpm --dir <prefix> --ignore-workspace add`) → run the installed `nevo-spec` **through its `.bin` shim on `PATH`**: `--help` / `--version` / `dashboard` / unknown-command; assert the exact tarball file list, the manifest (version, `engines`, no deps/scripts, no `workspace:`), and the Commander license in `THIRD_PARTY_NOTICES.txt`. Nothing resolves through the repo's `node_modules`. |

## Future GitHub Release compatibility

`Release` is **not** changed to attach the tarball in this pass. When it is, it calls
`nevo-repo-product pack` — the same entrypoint — rather than re-implementing packing.
There is still no npm publish.
