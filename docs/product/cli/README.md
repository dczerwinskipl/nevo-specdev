---
id: docs.product-cli-readme
type: hub
title: CLI product documentation
status: current
summary: >
  The nevo-spec command-line product — who uses it and how it should behave. Node CLI
  implementation guidance is under development/cli/.
---

# CLI product (`nevo-spec`)

Product behavior of the `nevo-spec` command-line tool. How Node CLIs are _built_ is in
[`../../development/cli/`](../../development/cli/).

| Doc                                          | Covers                                                                                                                  |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [Public CLI contract](nevo-spec-contract.md) | The commands that actually exist today (`--help`, `--version`, `dashboard`) and what is explicitly not implemented yet. |
| [Personas](personas.md)                      | Who runs `nevo-spec` and what they need from it.                                                                        |
| [Interaction model](interaction-model.md)    | Command shape, output contract, human vs. agent vs. CI use.                                                             |

`@nevo/specdev` is packaged and installed as a single artifact — see
[product packaging](../../development/product-packaging.md) and
[dogfooding](../../development/dogfooding.md).
