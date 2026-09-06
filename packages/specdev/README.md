# `@nevo/specdev`

The public **Nevo SpecDev** product package — it ships the `nevo-spec` command-line
interface.

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

`nevo-spec dashboard` currently only routes into the
[`@nevo/specdev-dashboard`](../specdev-dashboard/README.md) capability package and
prints a deterministic marker. **It does not start the real dashboard yet** — the
dashboard server / UI / runtime are not migrated. Everything else (`init`, `status`,
`workflow`, `install`, `update`, …) is future direction and is intentionally **not**
present in `--help`.

## How it is built and shipped

- `src/program.ts` is a thin Commander router; `src/bin.ts` is the executable boundary
  (construct IO → `createProgram` → `parseAsync` → exit code). No product logic lives in
  either. Sibling capability packages never import Commander.
- The distributable is a **single self-contained bundle**: `nevo-repo-product`
  (esbuild) compiles the entry, the internal `@nevo/specdev-dashboard` capability, and
  `commander` into `dist/bin.js`, so the tarball installs with **no registry and no
  workspace**. The source dependency on `@nevo/specdev-dashboard` stays a real
  `workspace:*` edge — only the distribution is one artifact.
- `nevo-spec --version` is injected at bundle time from `nevo-release version` (the
  repository's canonical version model); the installed artifact never reads the
  repo's `version.json`.

See [`docs/development/product-packaging.md`](../../docs/development/product-packaging.md)
and [`docs/development/dogfooding.md`](../../docs/development/dogfooding.md).
