# Workflows

| Workflow                                       | Trigger                             | Purpose                                                         |
| ---------------------------------------------- | ----------------------------------- | --------------------------------------------------------------- |
| [`ci.yml`](ci.yml)                             | PRs; pushes to `main`, `release/v*` | Format, lint, docs index, script tests, typecheck, test, build. |
| [`pr-title.yml`](pr-title.yml)                 | PR opened / edited / synced         | Conventional Commits check on the PR title.                     |
| [`cut-release-line.yml`](cut-release-line.yml) | `workflow_dispatch`                 | Branch `release/vX.Y` off `main`; open the main-bump PR.        |

Full behavior: [`docs/development/ci.md`](../../docs/development/ci.md) and
[`docs/development/releasing.md`](../../docs/development/releasing.md).

## Action pinning

Third-party and official actions are pinned to **release tags** (`actions/checkout@v4`,
`amannn/action-semantic-pull-request@v5.5.3`), not commit SHAs.

Trade-off: a tag is mutable — the owner of an action can move it — so tag-pinning trusts
the action's maintainers and GitHub's tag protections rather than being
cryptographically immutable. This is an accepted risk for the current set (all
widely-used, from `actions/*` or a well-known maintainer). Dependabot's
`github-actions` updater watches these for new versions.

If supply-chain requirements tighten, switch to SHA pins (`uses: actions/checkout@<sha> # v4.x`)
— Dependabot keeps the trailing version comment in sync.

## CodeQL

Deliberately **not** enabled yet: there is no product source code in the repository, so
CodeQL would scan only small Node tooling scripts and report nothing useful. Enable it
in the same change that migrates the first real product package — add a
`github/codeql-action` workflow for `javascript-typescript` and make `CodeQL` a
required check.
