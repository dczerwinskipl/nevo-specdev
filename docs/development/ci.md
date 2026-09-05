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

Two workflows under [`.github/workflows/`](../../.github/workflows/):

| Workflow   | Trigger                                | Does                                                                          |
| ---------- | -------------------------------------- | ----------------------------------------------------------------------------- |
| `pr-title` | PR opened / edited / synchronized      | Validates the PR title against [Conventional Commits](commit-conventions.md). |
| `ci`       | PRs; pushes to `main` and `release/v*` | Format, lint, docs index, typecheck, test, build.                             |

## `ci` jobs

| Job       | Steps                                                                                                       |
| --------- | ----------------------------------------------------------------------------------------------------------- |
| `quality` | `pnpm format:check`, `pnpm lint`, `pnpm docs:check`, an affected-graph dry-run, then `turbo run typecheck`. |
| `test`    | `turbo run test`.                                                                                           |
| `build`   | `turbo run build`.                                                                                          |

Format, lint and the docs index run **repository-wide** — one Prettier config and one
ESLint flat config, so package filtering has no meaning for them.

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
PR title / validate
CI / quality
CI / test
CI / build
```

They are added to the rulesets by
[`scripts/github/configure-repository.mjs`](../../scripts/github/README.md) once
confirmed from a real run. A job whose `--affected` run selected nothing still exits 0
and reports its check green, so a PR is never left permanently pending.

Concurrency: a new commit on a PR cancels the previous PR run; `main` / `release/v*`
runs always finish.

## What invalidates everything

Turbo hashes `pnpm-lock.yaml` and every file in `turbo.json#globalDependencies`
(`tsconfig.base.json`, `.prettierrc.json`, `.prettierignore`, `.editorconfig`,
`.npmrc`, `.nvmrc`). Changing any of them busts every package's cache — a lockfile bump
or a base-tsconfig change is expected to rebuild and retest the whole graph.

## Reproducing locally

```bash
pnpm check                                             # what CI runs, whole repo
pnpm exec turbo run build test typecheck --affected --dry   # what a PR would select
pnpm exec turbo run test --filter <package>            # one package
```
