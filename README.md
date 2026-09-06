# Nevo SpecDev

**Nevo SpecDev** is a spec-driven development framework for AI-assisted software
engineering: a human-led, spec-anchored workflow delivered as a CLI (`nevo-spec`) and a
dashboard.

- **Human-led.** The repository owner makes the architectural and scope calls; AI agents
  propose options and implement approved work inside an explicitly declared context.
- **Spec-anchored.** Non-trivial changes are tied to a specification, classified by
  weight, with explicit owner approval gates.
- **Deterministic and tool-enforced.** The spec/task lifecycle and documentation
  discovery run through commands with stable, machine-readable output.
- **Vendor-neutral.** The workflow is exposed to AI coding agents through thin adapters
  over a single source of truth.

See [`docs/product/product-overview.md`](docs/product/product-overview.md) for the
product overview and [`docs/`](docs/README.md) for everything else.

## Getting started

```bash
corepack enable                 # once per machine
pnpm install                    # Node 24 LTS (.nvmrc), pnpm 10 via Corepack
pnpm check                      # the full local quality gate
```

`pnpm check` runs format, lint, documentation validation, the version-metadata gate,
and every package's typecheck / test / build. Full setup and the command reference:
[`docs/development/local-setup.md`](docs/development/local-setup.md).

## Repository shape

| Path              | Contents                                                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/`           | Deployable applications (`nevo-spec` CLI, dashboard).                                                                                          |
| `packages/`       | Shared and publishable libraries under the `@nevo/*` scope.                                                                                    |
| `tools/`          | Repository-internal tooling — [`tools/docs`](tools/docs/README.md) (`nevo-docs`), [`tools/release`](tools/release/README.md). Never published. |
| `docs/`           | [Documentation](docs/README.md): development, product, architecture.                                                                           |
| `scripts/github/` | Idempotent GitHub governance apply/verify (`gh` API).                                                                                          |

## Contributing

Branches and pull requests only — no direct commits to `main` or `release/v*`. Squash
merge; the PR title is the commit message and follows Conventional Commits. See
[`CONTRIBUTING.md`](CONTRIBUTING.md) and
[`docs/development/git-workflow.md`](docs/development/git-workflow.md).

## License

[MIT](LICENSE) — see ADR
[`0004-mit-license`](docs/architecture/decisions/0004-mit-license.md).
