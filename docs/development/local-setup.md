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
  owns the task graph. This repository is Node/TypeScript only — no .NET.
related:
  - development.git-workflow
  - development.cli.testing-guidelines
  - architecture.repository-structure
---

# Local setup

## Prerequisites

| Tool     | Version                                | Notes                                                     |
| -------- | -------------------------------------- | --------------------------------------------------------- |
| Node.js  | `>=22.13.0`; `.nvmrc` pins `24.20.0`   | Current Active LTS. `nvm use` / `fnm use` reads `.nvmrc`. |
| Corepack | bundled with Node (keep it current)    | Activates the pinned pnpm — do not `npm i -g pnpm`.       |
| pnpm     | `12.3.4` (pinned via `packageManager`) | Corepack downloads it on first use.                       |
| Git      | any recent                             | —                                                         |

```bash
corepack enable          # once per machine
node -v                  # 24.x (or ≥ 22.13)
pnpm -v                  # 12.3.4, provided by Corepack
```

If a bundled Corepack is too old to fetch pnpm 12, update it:
`npm i -g corepack@latest`.

## Install

```bash
pnpm install             # frozen against pnpm-lock.yaml
```

## Standard commands

Run from the repository root:

| Command             | What it does                                                                    |
| ------------------- | ------------------------------------------------------------------------------- |
| `pnpm build`        | `turbo run build` across affected/all packages.                                 |
| `pnpm test`         | `turbo run test`.                                                               |
| `pnpm lint`         | `eslint .` over the whole repo (one flat config; not a per-package task).       |
| `pnpm typecheck`    | `turbo run typecheck` (`tsc` per package).                                      |
| `pnpm format`       | Prettier write across the repo.                                                 |
| `pnpm format:check` | Prettier check (what CI runs).                                                  |
| `pnpm check`        | `format:check` + `lint` + `turbo run typecheck test build`. Run before pushing. |
| `pnpm docs:check`   | Validate doc frontmatter + the generated index.                                 |

With no packages defining a task, `turbo run <task>` prints "No tasks were executed"
and exits 0 — that is expected while the workspace is still mostly empty.

## Turborepo

Turborepo owns the package task graph. Key points:

- Task dependencies are declared in [`turbo.json`](../../turbo.json) (`^build` means
  "build dependencies first"). CI adds `--affected` so only changed packages and their
  dependents run — see [ci-and-affected-packages](../architecture/repository-structure.md).
- Editing a root input listed in `turbo.json#globalDependencies` (tsconfig base, ESLint
  config, Prettier config, `.npmrc`, `.nvmrc`) or `pnpm-lock.yaml` invalidates **every**
  package's cache on purpose.
- `pnpm exec turbo ls` lists workspace packages; `pnpm exec turbo run build --affected --dry`
  shows what a change would run.

## No .NET

The upstream Nevo project is a .NET solution with Node/React tooling. Only that tooling
lineage is carried forward here. This repository has no .NET SDK, projects, or build
steps.
