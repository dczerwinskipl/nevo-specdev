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

| Doc                                                   | Covers                                                                           |
| ----------------------------------------------------- | -------------------------------------------------------------------------------- |
| [Node tooling guidelines](node-tooling-guidelines.md) | Module boundaries, thin CLI entrypoints, pure logic vs I/O, DI, output contract. |
| [Testing guidelines](testing-guidelines.md)           | Test stack (Vitest / `node:test`), what to test where, coverage.                 |

The only Node tool in the repository today is
[`tools/docs`](../../../tools/docs/README.md) (`nevo-docs`). These guidelines are
written to hold as more tooling and, later, the product CLI arrive.
