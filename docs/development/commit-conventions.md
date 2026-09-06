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
  Conventional Commits `<type>(<scope>): <description>` is the required PR-title format
  (it becomes the squash commit message). A scope is required; scopes are open-ended.
  Branch-local checkpoint commits are exempt.
related:
  - development.git-workflow
  - development.pull-requests
---

# Commit conventions

[Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/) is the
**pull request title** format. Because every PR is squash-merged, the PR title is the
permanent commit message on `main` / `release/v*`. The `pr-title` check validates it
(`requireScope: true`); it does **not** validate individual checkpoint commits on the
branch — those disappear on squash, so agents and developers may use informal
checkpoint messages freely, and the feature branch's existing history is not rewritten
just to add scopes.

## Format

```text
<type>(<scope>)<!>: <description>

[optional body]

[optional footer(s)]
```

- `<description>`: imperative mood, lower-case start, no trailing period, ≤ ~72 chars.
- `<scope>`: **required** — the area of the change; see the list below.
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

## Scopes

The scope names the area of the change and is **required** on the PR title. The list is
**open-ended, not a whitelist** — the `pr-title` check only requires that _a_ scope is
present, so a new real package or capability area is added simply by using it. Current
conventional scopes:

| Scope        | Area                                                     |
| ------------ | -------------------------------------------------------- |
| `workspace`  | root workspace config, monorepo plumbing, formatting     |
| `cli`        | the future `nevo-spec` product CLI                       |
| `dashboard`  | the future dashboard app                                 |
| `core`       | shared product library                                   |
| `release`    | `tools/release` — version model, cut / promote / release |
| `docs`       | documentation under `docs/`                              |
| `docs-tools` | `tools/docs` — discovery, index, ADR authoring           |
| `github`     | `tools/github` — GitHub governance                       |
| `ci`         | GitHub Actions workflows / CI configuration              |
| `deps`       | dependency version bumps                                 |

Pick the tightest scope that fits. Add a new one when a genuinely new area appears —
do not stretch an existing scope, and do not invent noise.

## Examples

```text
feat(cli): add the command router
fix(release): reject a stale release-branch checkout
ci(release): add the Promote release workflow
docs(release): document the operator release flow
build(deps): pin turbo to 2.10.12
chore(workspace): move project settings into pnpm-workspace.yaml
```

## Breaking changes

```text
feat(core)!: replace the SpecDocument schema

BREAKING CHANGE: `SpecDocument.version` is now required and must be SemVer.
```

Behavior changes count as breaking even without an API signature change. Before 1.0.0,
breaking changes are permitted per the [0.x policy](../architecture/repository-structure.md#0x-policy)
but must still be intentional, marked, and documented.
