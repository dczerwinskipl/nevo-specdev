---
id: docs.development-readme
type: hub
title: Development documentation
status: current
summary: >
  Entry point for engineering work in this repository — process, Node tooling, testing,
  and UI implementation conventions.
---

# Development documentation

Engineering rules for contributors and coding agents working **on** Nevo SpecDev.
Product behavior, personas and UX contracts live under [`../product/`](../product/), not
here.

## Process

| Doc                                                       | Covers                                                             |
| --------------------------------------------------------- | ------------------------------------------------------------------ |
| [Local setup](local-setup.md)                             | Node, Corepack/pnpm, the standard root commands, Turborepo basics. |
| [Git workflow](git-workflow.md)                           | Branch model, protected branches, squash merge, release lines.     |
| [Commit conventions](commit-conventions.md)               | Conventional Commits — the PR title format.                        |
| [Pull requests](pull-requests.md)                         | PR template, review expectations, merge gate.                      |
| [Continuous integration](ci.md)                           | What CI runs, affected-package scoping, required checks.           |
| [Releasing and version lines](releasing.md)               | version.json, derived builds, cutting a line, tagging, hotfixes.   |
| [Dependencies and security](dependencies-and-security.md) | Dependabot, action pinning, vuln reports, enabled features.        |

## Implementation guidance

| Area           | Covers                                                   |
| -------------- | -------------------------------------------------------- |
| [`cli/`](cli/) | Node CLI / developer-tooling architecture and testing.   |
| [`ui/`](ui/)   | Cross-UI engineering, then React / Tailwind / Storybook. |

## Architecture

Repository structure and durable decisions are in
[`../architecture/`](../architecture/). Read an ADR when a task touches an area where a
decision has already been recorded.
