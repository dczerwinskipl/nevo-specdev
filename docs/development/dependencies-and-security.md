---
id: development.dependencies-and-security
type: development
title: Dependencies and security
status: current
read_when:
  - reviewing a Dependabot pull request
  - reporting or triaging a vulnerability
  - deciding how to pin a GitHub Action
  - wondering when CodeQL gets turned on
summary: >
  How dependency updates arrive (Dependabot, grouped, weekly), how versions are pinned,
  the vulnerability-report path, the repository security features that are enabled, and
  when CodeQL should be added.
related:
  - development.local-setup
  - development.ci
---

# Dependencies and security

## Dependency versions

- Package versions are **exact** in `package.json` — `pnpm-workspace.yaml` sets
  `savePrefix: ""` so `pnpm add` never writes a range. Every bump is a visible diff.
- The toolchain baseline, and why pnpm and TypeScript are each held a line back, are in
  ADR [0002](../architecture/decisions/0002-toolchain-selection.md).

## Lockfile shape and the dependency graph

The repository pins **pnpm 10** on purpose. pnpm 11+ writes a multi-document
`pnpm-lock.yaml` that GitHub's Dependency Graph and Dependabot cannot parse — they read
only the first document and report **zero dependencies**
(`dependabot/dependabot-core#14794`). pnpm 10's single-document lockfile is parsed
correctly, so Dependabot actually has a dependency tree to scan.

`.gitattributes` marks `pnpm-lock.yaml` `linguist-generated=true` (collapsed by default,
excluded from language stats) but **not** `-diff` — a lockfile must stay diffable in PR
review for supply-chain and reproducibility checks.

Verify after any lockfile change:

```bash
grep -c '^---$' pnpm-lock.yaml     # must be 0 (single YAML document)
```

And, on the default branch, that GitHub sees real dependencies:

```bash
gh api repos/OWNER/REPO/dependency-graph/sbom --jq '.sbom.packages | length'
```

## Dependabot

[`.github/dependabot.yml`](../../.github/dependabot.yml), weekly (Monday):

| Ecosystem        | Grouping                                                                 | Commit prefix                     |
| ---------------- | ------------------------------------------------------------------------ | --------------------------------- |
| `npm` (pnpm)     | minor + patch collapsed into one `npm-minor-patch` PR; majors individual | `build(deps)` / `build(deps-dev)` |
| `github-actions` | all in one `github-actions` PR                                           | `ci(deps)`                        |

Both groups are `applies-to: version-updates`, so grouping only affects the scheduled
weekly run. Dependabot **security** updates (out-of-cycle patches for advisories) are
enabled separately, are never grouped, and always arrive as their own PR.

### `@types/node` tracks the runtime major

`@types/node` major is **ignored** by the updater
(`ignore: @types/node / version-update:semver-major`). The typings major must match the
Node major the repository actually runs (`engines.node: ">=24.20.0 <25"`, CI on
`24.20.0`), so moving to `25.x` / `26.x` typings is part of a deliberate runtime bump
(`engines` + `.nvmrc` + CI), not a routine Dependabot PR. Patch/minor bumps inside the
Node 24 line are still proposed and land in the weekly `npm-minor-patch` group. No other
package's majors are suppressed — they each still get an individual PR for review.

### Bot PR titles

The `commit-message.prefix` values are valid Conventional Commits types, and grouped
Dependabot PRs (`build(deps): bump the … group …`) pass the `pr-title` check unchanged.
A **single-package** bump, though, gets an upper-case subject
(`build(deps-dev): Bump @types/node from …`), which `pr-title` rejects
(`subjectPattern: ^(?![A-Z])…`). The
[`dependabot-pr-title`](../../.github/workflows/dependabot-pr-title.yml) workflow fixes
this: after a `PR title` run **fails**, a `workflow_run` follow-up re-reads the PR from
the API, and — only when the author is `dependabot[bot]`, the PR is open, and its head
still matches the failed run — lower-cases the first letter of the subject (leaving a
missing scope or an unknown type for `pr-title` to reject) and re-runs that exact `PR
title` run. It uses `workflow_run` rather than `pull_request_target` because GitHub
gives a Dependabot-triggered `pull_request` / `pull_request_target` workflow a read-only
token; the follow-up never checks out or executes PR content and holds only
`pull-requests: write` + `actions: write`. The global `pr-title` convention is unchanged
— human PRs are validated exactly as before.

Review a Dependabot PR like any other: `pnpm check` must pass; skim the changelog for
behavior changes; for a grouped PR, note anything that isn't purely mechanical.

## GitHub Action pinning

Every `uses:` is pinned to a **full commit SHA** with a trailing version comment; a tag
is mutable, a SHA is not. Dependabot's `github-actions` updater keeps both current. The
table of pins is in [`.github/workflows/README.md`](../../.github/workflows/README.md).

## Vulnerability reports

Private reporting via the repository **Security** tab — see [`SECURITY.md`](../../SECURITY.md).
Do not open a public issue.

## Enabled security features

Verified on GitHub:

- Dependabot alerts
- Dependabot security updates
- Secret scanning
- Secret scanning push protection
- Private vulnerability reporting

Re-check with:

```bash
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
gh api "repos/$REPO" --jq '.security_and_analysis'
gh api "repos/$REPO/private-vulnerability-reporting"
```

## CodeQL

Not enabled yet — the repository has no product source code to analyze. Add
`github/codeql-action` (`javascript-typescript`) and make `CodeQL` a required check in
the same change that migrates the first product package. See
[`.github/workflows/README.md`](../../.github/workflows/README.md#codeql).
