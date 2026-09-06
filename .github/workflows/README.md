# Workflows

| Workflow                                       | Trigger                             | Purpose                                                                      |
| ---------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------- |
| [`ci.yml`](ci.yml)                             | PRs; pushes to `main`, `release/v*` | `pnpm check:quality`, then affected typecheck / test / build.                |
| [`pr-title.yml`](pr-title.yml)                 | PR opened / edited / synced         | Conventional Commits check on the PR title.                                  |
| [`release.yml`](release.yml)                   | `workflow_dispatch` on `release/v*` | Verify HEAD CI, then tag + GitHub Release (`beta`/`rc`/`stable`).            |
| [`cut-release-line.yml`](cut-release-line.yml) | `workflow_dispatch`                 | Branch `release/vX.Y` off current `main`; open or hand off the main-bump PR. |

Full behavior: [`docs/development/ci.md`](../../docs/development/ci.md) and
[`docs/development/releasing.md`](../../docs/development/releasing.md).

## Action pinning

Every `uses:` is pinned to a **full commit SHA**, with the human-readable version as a
trailing comment:

```yaml
uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
```

A tag is mutable — its owner can move it — so a SHA is the only immutable reference.
Dependabot's `github-actions` updater bumps both the SHA and the comment together, so
this costs nothing to maintain.

Current pins:

| Action                                | SHA                                        | Version |
| ------------------------------------- | ------------------------------------------ | ------- |
| `actions/checkout`                    | `3d3c42e5aac5ba805825da76410c181273ba90b1` | v7.0.1  |
| `actions/setup-node`                  | `820762786026740c76f36085b0efc47a31fe5020` | v7.0.0  |
| `actions/cache`                       | `55cc8345863c7cc4c66a329aec7e433d2d1c52a9` | v6.1.0  |
| `amannn/action-semantic-pull-request` | `48f256284bd46cdaab1048c3721360e808335d50` | v6.1.1  |

## CodeQL

Deliberately **not** enabled yet: there is no product source code in the repository, so
CodeQL would scan only small Node tooling scripts and report nothing useful. Enable it
in the same change that migrates the first real product package — add a
`github/codeql-action` workflow for `javascript-typescript` and make `CodeQL` a
required check.
