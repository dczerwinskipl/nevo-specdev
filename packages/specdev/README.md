# `@nevo/specdev`

The public **Nevo SpecDev** product package — it ships the `nevo-spec` command-line
interface. This package is the CLI **shell**: the root program, `--version`, global
flags, the output / error / exit conventions, and command **composition**. It does not
define the individual commands — each capability vertical does (e.g.
[`@nevo/specdev-dashboard/cli`](../specdev-dashboard/README.md)).

|                |                 |
| -------------- | --------------- |
| **Product**    | Nevo SpecDev    |
| **Package**    | `@nevo/specdev` |
| **CLI**        | `nevo-spec`     |
| **Repository** | `nevo-specdev`  |

## Implemented CLI surface

```bash
nevo-spec --help        # usage + the command list
nevo-spec --version     # the installed product version (carried in the artifact)
nevo-spec dashboard     # bootstrap proof — see below
```

`nevo-spec dashboard` is defined in
[`@nevo/specdev-dashboard/cli`](../specdev-dashboard/README.md) and composed here; it
currently only routes into that vertical's capability and prints a deterministic marker.
**It does not start the real dashboard yet** — the dashboard server / UI / runtime are
not migrated. Everything else (`init`, `status`, `workflow`, `install`, `update`, …) is
future direction and is intentionally **not** present in `--help`.

## How it is built and shipped

- `src/program.ts` is the shell / composition root; `src/bin.ts` is the executable
  boundary (construct IO → `createProgram` → `parseAsync` → exit code). No product logic
  lives in either, and no command is defined here — `program.addCommand(
createDashboardCommand(ctx))`. A capability vertical's `./cli` adapter uses Commander;
  its capability/runtime does not.
- The distributable is a **single self-contained bundle**: `nevo-repo-product`
  (esbuild) compiles the entry, `@nevo/specdev-dashboard` (`.` and `./cli`), and
  `commander` into `dist/bin.js`, so the tarball installs with **no registry and no
  workspace**. The source dependency on `@nevo/specdev-dashboard` stays a real
  `workspace:*` edge — only the distribution is one artifact.
- Third-party code embedded in the bundle (Commander) ships its license in
  `THIRD_PARTY_NOTICES.txt`.
- `nevo-spec --version` is injected at bundle time from `nevo-release version` (the
  repository's canonical version model); the installed artifact never reads the
  repo's `version.json`.

See [`docs/development/product-packaging.md`](../../docs/development/product-packaging.md)
and [`docs/development/dogfooding.md`](../../docs/development/dogfooding.md).
