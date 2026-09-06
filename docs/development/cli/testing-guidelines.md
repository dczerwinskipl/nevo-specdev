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
  Test stack (Vitest), the domain / application / CLI-smoke split, determinism rules,
  and how tests fit the Turborepo task graph.
related:
  - development.cli.node-tooling-guidelines
  - development.local-setup
---

# Testing guidelines

## Stack

| Tool                  | Role                                         |
| --------------------- | -------------------------------------------- |
| **Vitest 5**          | The test runner for every `tools/*` package. |
| `@vitest/coverage-v8` | Coverage, when a package opts in.            |

One runner, TypeScript tests, `"test": "vitest run"` in the package's `test` script.

## What to test, and where

1. **Domain (`src/domain/`)** — validation rules, state transitions, path/glob
   calculation, normalization, scoring, planning. Fast, no mocks. This is the bulk of
   the suite.
2. **Application (`src/app/`)** — the use cases, driven by in-memory fakes of the ports
   (`GitClient`, `GitHubClient`, `DocRepository`, `GitHubAdminClient`) per the
   [Node tooling guidelines](node-tooling-guidelines.md). The interesting scenario
   matrices live here (e.g. the release phase-A/phase-B recovery cases).
3. **Adapters (`src/infra/`)** — a temp-dir / temp-repo integration test for the real
   filesystem or git wrapper where it is worth it.
4. **CLI smoke (`test/cli/`)** — a subprocess suite against the built `dist/bin.js`:
   `--help`, an unknown command exits non-zero, an invalid option exits non-zero, one
   happy path, one clean-`--json`-on-stdout path. Do not re-test Commander. Keep
   importable logic in `src/index.ts`; `bin.ts` is a dedicated executable, never
   imported by tests.

## Determinism

- No reliance on wall-clock time, network, locale, or ambient environment. Inject a
  clock; freeze time where output includes timestamps.
- Generated files carry **no** timestamp; a check compares against a freshly-built
  expected value byte-for-byte — see `tools/docs/test/domain/index-file.test.ts`.
- Tests must pass regardless of run order and in parallel.

## Turborepo integration

Each `tools/*` package exposes `build` / `typecheck` / `test`. Its `turbo.json` makes
`test` depend on **its own `build`** as well as `^build`, because the CLI smoke suite
runs the built `dist/bin.js`. `**/*.md` is excluded from the input hash. On PRs, CI
runs `test` with `--affected`, so a change to a shared package also runs its
dependents' tests — this only works if workspace `dependencies` / `devDependencies` are
declared correctly. `pnpm check` builds the tools first, then runs the repo-wide gate.

## Coverage

No repository-wide threshold yet. When a package carries meaningful logic, add
`@vitest/coverage-v8` and a threshold in that package's Vitest config. Coverage is a
signal for finding untested branches, not a target to game.
