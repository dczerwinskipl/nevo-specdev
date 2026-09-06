---
id: docs.development-cli-readme
type: hub
title: CLI & Node tooling documentation
status: current
summary: >
  Engineering guidance for Node-based command-line tools and developer tooling in this
  repository — architecture and testing.
---

# CLI & Node tooling

How Node CLIs and developer tooling are built here. This is **implementation**
guidance; the product behavior of the `nevo-spec` CLI (personas, command surface,
interaction model) lives under [`../../product/cli/`](../../product/cli/).

| Doc                                                   | Covers                                                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [Node tooling guidelines](node-tooling-guidelines.md) | Commander, thin entrypoints, command-local options, pure logic vs I/O ports, DI, output contract. |
| [Testing guidelines](testing-guidelines.md)           | Test stack (Vitest), the domain / application / CLI-smoke split, determinism, coverage.           |

The reference implementations are the three TypeScript packages under `tools/`:
[`tools/docs`](../../../tools/docs/README.md) (`nevo-docs`),
[`tools/release`](../../../tools/release/README.md) (`nevo-release`) and
[`tools/github`](../../../tools/github/README.md) (`nevo-repo-github`). The same pattern
is intended for the future `nevo-spec` product CLI.
