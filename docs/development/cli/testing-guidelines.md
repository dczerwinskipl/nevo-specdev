---
id: development.cli.testing-guidelines
type: development
title: Testing guidelines
status: current
read_when:
  - writing tests for a package or tool
  - choosing a test approach
  - adding a test task to a package
summary: >
  Test stack (Vitest, with node:test acceptable for zero-dep tools), what to test at
  which boundary, determinism rules, and how tests fit the Turborepo task graph.
related:
  - development.cli.node-tooling-guidelines
  - development.local-setup
---

# Testing guidelines

## Stack

| Tool                        | Role                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| **Vitest 5**                | Default test runner for packages and tools.                                                   |
| `node:test` + `node:assert` | Acceptable for a tool that otherwise has **zero** runtime deps and wants to keep it that way. |
| `@vitest/coverage-v8`       | Coverage, when a package opts in.                                                             |

Pick one runner per package and state it in that package's `test` script. Do not mix
runners within a package.

## What to test, and where

1. **Pure logic** — validation rules, state transitions, path/glob calculation,
   normalization, scoring. Fast, no mocks. This is the bulk of the suite.
2. **Application operations** — orchestration with controlled fakes for git, filesystem
   and clock injected per the [Node tooling guidelines](node-tooling-guidelines.md).
3. **Adapters** — integration tests against a realistic boundary (a git wrapper against
   a temp repo, a process runner).
4. **CLI boundary** — argument parsing, validation failures, stdout/stderr shape, exit
   codes. Prefer importing and calling the command function; reserve spawned-process
   tests for a few end-to-end smoke cases. A CLI entry file must guard its dispatch
   (`if (import.meta.url === …)` or an explicit `main()` call) so internals import
   cleanly under test.

## Determinism

- No reliance on wall-clock time, network, locale, or ambient environment. Inject a
  clock; freeze time where output includes timestamps.
- Generated-file checks compare against a freshly-built expected value with the
  timestamp line stripped — see `tools/docs/test/index-file.test.mjs`.
- Tests must pass regardless of run order and in parallel.

## Turborepo integration

Each package exposes a `test` script; `turbo run test` runs it. The `test` task in
`turbo.json` depends on `^build`, excludes `**/*.md` from its input hash, and caches
`coverage/**`. On PRs, CI runs `test` with `--affected`, so a change to a shared
package also runs its dependents' tests — this only works if `dependencies` /
`devDependencies` between workspace packages are declared correctly.

## Coverage

No repository-wide threshold yet. When a package carries meaningful logic, add
`@vitest/coverage-v8` and a threshold in that package's Vitest config. Coverage is a
signal for finding untested branches, not a target to game.
