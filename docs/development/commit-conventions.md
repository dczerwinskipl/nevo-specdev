---
id: development.commit-conventions
type: development
title: Commit conventions
status: current
read_when:
  - writing a pull request title
  - writing a commit message
  - reviewing a pull request
summary: >
  Conventional Commits is the PR-title format (the squash commit message). Branch-local
  checkpoint commits are exempt.
related:
  - development.git-workflow
  - development.pull-requests
---

# Commit conventions

[Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) is the
**pull request title** format. Because every PR is squash-merged, the PR title is the
permanent commit message on `main` / `release/v*`. CI validates the PR title; it does
**not** validate individual checkpoint commits on the branch.

## Format

```text
<type>(<scope>)<!>: <description>

[optional body]

[optional footer(s)]
```

- `<description>`: imperative mood, lower-case start, no trailing period, ≤ ~72 chars.
- `<scope>`: optional; see the list below.
- `!` before the colon marks a breaking change (also add a `BREAKING CHANGE:` footer).

## Types

| Type       | Use for                                      |
| ---------- | -------------------------------------------- |
| `feat`     | user-visible capability or behavior          |
| `fix`      | bug fix                                      |
| `docs`     | documentation only                           |
| `refactor` | code change with no behavior change          |
| `test`     | adding or correcting tests                   |
| `build`    | build system, dependencies, workspace config |
| `ci`       | GitHub Actions / CI configuration            |
| `chore`    | maintenance, tooling, formatting             |
| `perf`     | performance improvement                      |
| `revert`   | reverting a previous commit                  |

## Scopes (initial)

The product code is not migrated yet, so scopes currently cover the repository itself:

```text
repo      workspace   docs      ci        deps
tooling   docs-tools  release   github
```

Add product scopes (`cli`, `dashboard`, `core`, …) when the corresponding packages are
migrated. An unknown or omitted scope is acceptable — do not invent noise.

## Examples

```text
feat(docs-tools): add `context` command for agent file discovery
fix(ci): give affected detection full git history on PRs
docs(development): document the hotfix flow for maintained release lines
build(deps): pin turbo to 2.10.12
chore(workspace): move project settings into pnpm-workspace.yaml
ci: add PR title validation with amannn/action-semantic-pull-request
```

## Breaking changes

```text
feat(core)!: replace the SpecDocument schema

BREAKING CHANGE: `SpecDocument.version` is now required and must be SemVer.
```

Behavior changes count as breaking even without an API signature change. Before 1.0.0,
breaking changes are permitted per the [0.x policy](../architecture/repository-structure.md#0x-policy)
but must still be intentional, marked, and documented.
