---
id: adr.0003-branch-and-release-model
type: adr
title: Branch and release model
status: current
date: 2026-09-05
summary: >
  main carries the next development version; short-lived feature/ and fix/ branches
  merge into it by squash-only PR; each maintained minor line has one long-lived
  release/vX.Y branch. The next-version choice (minor vs major) is always an explicit
  input.
related:
  - development.git-workflow
  - architecture.repository-structure
---

# 0003 — Branch and release model

## Status

Current.

## Context

The project needs to maintain an older stable line while `main` moves forward. That
requires a defined set of branches, a merge policy for the ones that matter, and a
release-cutting process whose version step is unambiguous.

## Decision

**Branches**

| Branch                     | Role                                                                                  | Protected |
| -------------------------- | ------------------------------------------------------------------------------------- | --------- |
| `main`                     | Next development version, always a prerelease (`X.Y.0-alpha.<build>`).                | yes       |
| `feature/<slug>`           | New capability or behavior; merges into `main`.                                       | no        |
| `fix/<slug>`               | Bug fix; merges into `main`, or into `release/vX.Y` for a hotfix.                     | no        |
| `release/v<major>.<minor>` | One long-lived branch per maintained minor line; owns its whole `X.Y.z` patch series. | yes       |

`docs/<slug>` and `chore/<slug>` are accepted short-lived prefixes with the same rules
as `feature/`.

Patch releases within a line are **tags on that line's branch** (`v1.3.1`, `v1.3.2`),
produced from `release/v1.3` — the branch name stays at the minor granularity.

**Merge policy (protected branches)**

- Pull request required; squash merge only. Merge commits and rebase merges are
  disabled repository-wide. The PR title is the squash commit message and follows
  [Conventional Commits](../development/commit-conventions.md).
- Linear history; force-push and branch deletion blocked; merged head branches
  auto-deleted.
- Required status checks green; review conversations resolved; no blocking
  `Request changes`.
- `CODEOWNERS` records the authorized reviewer(s). The required-approval count is a
  ruleset setting, managed through GitHub as maintainers are added, so it always
  matches the people actually available to review.

**Versioning**

- The build identifier in `main`'s prerelease version is derived deterministically in
  CI from durable version-line metadata in the repository — it is not committed per
  change.
- Stable and RC tags are cut from a `release/vX.Y` branch, not from an arbitrary
  `main` commit.
- Cutting a release line is a manually-triggered workflow that takes the release line
  and the next development version (next minor **or** next major) as explicit inputs.
  It validates the SemVer inputs, creates `release/vX.Y` from the intended `main`
  commit, sets each branch's version state, and advances `main` through pull requests.

## Consequences

- A maintained line can take hotfixes by PR while `main` continues; those fixes are
  forward-ported to `main` and to other maintained lines.
- Everyday feature work carries no review/CI gate beyond what the author chooses —
  only `main` and `release/v*` are gated.
- The minor-vs-major step after a release cut is always stated by a person, never
  inferred by automation.
- Protected-branch configuration is applied and verified through
  [`scripts/github/`](../../../scripts/github/README.md) against the GitHub API.
