---
id: development.local-setup
type: development
title: Local setup
status: current
read_when:
  - setting up the development environment
  - running the standard repository commands
  - understanding what Turborepo does here
summary: >
  Prerequisites (Node, Corepack/pnpm), the standard root commands, and how Turborepo
  owns the task graph.
related:
  - development.git-workflow
  - development.cli.testing-guidelines
  - architecture.repository-structure
---

# Local setup

## Prerequisites

| Tool     | Version                                                                | Notes                                                                      |
| -------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Node.js  | `24` LTS — `.nvmrc` pins `24.20.0`, `engines` requires `>=24.20.0 <25` | The single contributor / CI runtime. `nvm use` / `fnm use` reads `.nvmrc`. |
| Corepack | bundled with Node (keep it current)                                    | Activates the pinned pnpm — do not `npm i -g pnpm`.                        |
| pnpm     | `10.34.5` (pinned via `packageManager`)                                | Newer pnpm lines break GitHub Dependency Graph — see ADR 0002.             |
| Git      | any recent                                                             | —                                                                          |

```bash
corepack enable          # once per machine
node -v                  # 24.x
pnpm -v                  # 10.34.5, provided by Corepack
```

If a bundled Corepack is too old to fetch the pinned pnpm, update it:
`npm i -g corepack@latest`.

## Install

```bash
pnpm install             # frozen against pnpm-lock.yaml
```

## Standard commands

Run from the repository root:

| Command                             | What it does                                                                                                           |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **`pnpm check`**                    | **The one gate to run before pushing** — `check:quality`, then `turbo run typecheck test build`.                       |
| `pnpm check:quality`                | Builds the `tools/*` packages, then `format:check` + `lint` + `docs:check` + `version:check-transition`. Reused by CI. |
| `pnpm build` / `test` / `typecheck` | `turbo run <task>` across the package graph.                                                                           |
| `pnpm lint`                         | `eslint .` over the whole repo (one flat config; not a per-package task).                                              |
| `pnpm format`                       | Prettier write across the repo.                                                                                        |
| `pnpm docs:check`                   | Validate the documentation corpus + the generated index.                                                               |
| `pnpm docs:adr new "…"`             | Create the next-numbered ADR from the template.                                                                        |
| `pnpm version:print`                | Print the CI build version for the current branch.                                                                     |

## Turborepo

Turborepo owns the package task graph. Key points:

- Task dependencies are declared in [`turbo.json`](../../turbo.json) (`^build` means
  "build dependencies first"). CI adds `--affected` so only changed packages and their
  dependents run — see [ci-and-affected-packages](../architecture/repository-structure.md).
- Editing `tsconfig.base.json` (listed in `turbo.json#globalDependencies`) or
  `pnpm-lock.yaml` invalidates **every** package's build/test/typecheck cache on
  purpose. Repo-wide quality config (Prettier, EditorConfig) is deliberately not
  global — it only affects `pnpm format` / `pnpm lint`, which are not Turbo tasks.
- `pnpm exec turbo ls` lists workspace packages; `pnpm exec turbo run build --affected --dry`
  shows what a change would run.
