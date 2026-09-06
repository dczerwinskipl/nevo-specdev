# Workflows

| Workflow                                       | Trigger                             | Purpose                                                                                   | `permissions`                                             |
| ---------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| [`ci.yml`](ci.yml)                             | PRs; pushes to `main`, `release/v*` | `pnpm check:quality`, then affected typecheck / test / build.                             | `contents: read`                                          |
| [`pr-title.yml`](pr-title.yml)                 | PR opened / edited / synced         | Conventional Commits check on the PR title (`<type>(<scope>): …`, scope required).        | `pull-requests: read`                                     |
| [`release.yml`](release.yml)                   | `workflow_dispatch` on `release/v*` | Verify HEAD CI, then tag + GitHub Release (`beta`/`rc`/`stable`); post-stable advance PR. | `contents: write`, `pull-requests: write`, `checks: read` |
| [`cut-release-line.yml`](cut-release-line.yml) | `workflow_dispatch`                 | Branch `release/vX.Y` off current `main`; open or hand off the main-bump PR.              | `contents: write`, `pull-requests: write`                 |
| [`promote-release.yml`](promote-release.yml)   | `workflow_dispatch` on `release/v*` | Open the PR moving `release/vX.Y`'s channel forward (`beta→rc` / `rc→stable`).            | `contents: write`, `pull-requests: write`                 |

Each workflow declares the **minimum** `permissions` for the GitHub APIs it actually
calls — `release.yml` adds `checks: read` because the release tool reads the
release-branch HEAD check-runs; the others neither read checks nor tag, so they don't.

The three `workflow_dispatch` workflows take an optional `CI_GITHUB_RELEASE_TOKEN`
secret (a fine-grained, repository-scoped PAT) so a PR they open triggers `pull_request`
CI and can auto-merge; without it they push the branch and print the exact
`gh pr create …` command. See
[`docs/development/releasing.md`](../../docs/development/releasing.md#ci_github_release_token).

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
