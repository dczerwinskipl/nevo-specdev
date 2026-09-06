---
id: development.ci
type: development
title: Continuous integration
status: current
read_when:
  - understanding what CI runs on a pull request
  - a required check is failing or missing
  - reproducing a CI failure locally
  - changing the CI workflow or required checks
summary: >
  What the CI workflows run, how affected-package execution is scoped on PRs, which
  checks are required to merge, and what invalidates the whole graph.
related:
  - development.local-setup
  - architecture.repository-structure
  - development.commit-conventions
---

# Continuous integration

Workflows under [`.github/workflows/`](../../.github/workflows/):

| Workflow                                         | Trigger                                | Does                                                                                                                 |
| ------------------------------------------------ | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `pr-title`                                       | PR opened / edited / synchronized      | Validates the PR title against [Conventional Commits](commit-conventions.md) — `<type>(<scope>): …`, scope required. |
| `ci`                                             | PRs; pushes to `main` and `release/v*` | The quality gate, then typecheck / test / build.                                                                     |
| `cut-release-line`, `promote-release`, `release` | `workflow_dispatch`                    | See [releasing](releasing.md).                                                                                       |

## `ci` jobs

| Job       | Steps                                                                                                                                                                                         |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `quality` | `pnpm check:quality` (builds `tools/*`, then format, lint, `docs:check`, `version:check-transition`), `pnpm version:print`, an affected-graph dry-run, then `turbo run typecheck --affected`. |
| `test`    | `turbo run test --affected`.                                                                                                                                                                  |
| `build`   | `turbo run build --affected`.                                                                                                                                                                 |

`check:quality` is the **same script contributors run** (`pnpm check` = `check:quality`

- the package graph), so local and CI cannot drift. Its steps run **repository-wide** —
  one Prettier config, one ESLint config, one doc corpus, one `version.json` — so package
  filtering has no meaning for them.

Typecheck, test and build are **package-scoped**:

- On a **pull request** they run with `--affected`, comparing
  `pull_request.base.sha`…`pull_request.head.sha`. Checkout uses `fetch-depth: 0` so
  the full history is present — a shallow clone would make every package look affected.
- On **`main` and `release/v*` pushes** they run over **all** packages (no `--affected`).
  Post-merge validation is deliberately more conservative than PR validation.

Affected execution includes a changed package's **dependents**, because that comes from
declared workspace `dependencies` — not a hard-coded matrix. The `quality` job prints
`turbo run … --dry=text` so you can see exactly which packages were selected and why.

## Required checks

The branch rulesets (`protected-main`, `protected-release-lines`) require these exact
check names — kept stable even if the steps inside them change:

```text
pr-title
quality
test
build
```

They are applied by
[`tools/github (nevo-repo-github)`](../../tools/github/README.md). A job whose
`--affected` run selected nothing still exits 0 and reports its check green, so a PR is
never left permanently pending.

The `release` workflow separately re-checks that a release branch's HEAD has `quality` +
`test` + `build` green (not `pr-title` — that only runs on PRs) before it cuts a tag.

Concurrency: a new commit on a PR cancels the previous PR run; `main` / `release/v*`
runs always finish.

## What invalidates everything

Turbo hashes `pnpm-lock.yaml` and root `package.json` automatically, plus every file in
`turbo.json#globalDependencies` — deliberately just `tsconfig.base.json`, which every
package's `tsconfig` extends. A lockfile bump or a base-tsconfig change rebuilds and
retests the whole graph.

Prettier / EditorConfig / ESLint config are **not** global inputs: they only change
the repo-wide `format` / `lint` results, which run outside Turbo, so changing them does
not invalidate unrelated package builds.

## Reproducing locally

```bash
pnpm check                                             # the full gate (= what CI runs)
pnpm check:quality                                     # just the repo-wide gate
pnpm exec turbo run build test typecheck --affected --dry   # what a PR would select
pnpm exec turbo run test --filter nevo-repo-release    # one package
```
