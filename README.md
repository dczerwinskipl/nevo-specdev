# Nevo SpecDev

**Nevo SpecDev** is a spec-driven development framework for AI-assisted software
engineering: a human-led, spec-anchored workflow delivered as a CLI (`nevo-spec`) and a
dashboard.

> **Early-stage.** This repository is being **bootstrapped** — workspace tooling,
> documentation architecture, Git/GitHub governance, CI, the versioning model, and a
> security baseline. The product implementation is **not here yet**; it will be migrated
> from the upstream Nevo project in reviewable pieces. Nothing below claims a shipped
> feature.

## What it will be

- **Human-led.** The repository owner makes architectural and scope decisions; AI agents
  propose options and implement approved work inside a declared context.
- **Spec-anchored.** Non-trivial changes are tied to a specification, classified by
  weight, with explicit owner approval gates.
- **Deterministic & tool-enforced.** The spec/task lifecycle and documentation discovery
  run through commands with stable, machine-readable output.
- **Vendor-neutral.** One workflow, thin adapters for Claude Code, Cursor, Copilot, and
  others.

See [`docs/product/product-overview.md`](docs/product/product-overview.md).

## Repository shape

| Path              | Contents                                                                                |
| ----------------- | --------------------------------------------------------------------------------------- |
| `apps/`           | Deployable apps (`cli`, `dashboard`) — added during migration.                          |
| `packages/`       | Shared / publishable libraries — added during migration.                                |
| `tools/`          | Repository-internal tooling. Today: [`tools/docs`](tools/docs/README.md) (`nevo-docs`). |
| `docs/`           | [Documentation](docs/README.md): development, product, architecture.                    |
| `scripts/github/` | Idempotent GitHub governance apply/verify scripts.                                      |

This repository is **Node/TypeScript only** — no .NET.

## Getting started

```bash
corepack enable                 # once per machine
pnpm install                    # Node >= 22.13 (.nvmrc pins 24.20.0), pnpm 12 via Corepack
pnpm check                      # format:check + lint + typecheck + test + build
pnpm docs:check                 # validate documentation frontmatter + index
```

Full setup and the standard commands: [`docs/development/local-setup.md`](docs/development/local-setup.md).

## Contributing

Branches and pull requests only — no direct commits to `main`. Squash merge; the PR
title is the commit message and follows Conventional Commits. See
[`CONTRIBUTING.md`](CONTRIBUTING.md), [`docs/development/git-workflow.md`](docs/development/git-workflow.md),
and [`docs/development/commit-conventions.md`](docs/development/commit-conventions.md).

## License

[MIT](LICENSE) — see ADR
[`0004-mit-license`](docs/architecture/decisions/0004-mit-license.md).
