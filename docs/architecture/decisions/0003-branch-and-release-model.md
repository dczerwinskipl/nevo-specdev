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
- Strict required status checks green; review conversations resolved; no blocking
  `Request changes`; GitHub's own merge-conflict block (no custom check).
- **Review is by repository access, not a file.** There is no `.github/CODEOWNERS`;
  collaborators/teams are managed in GitHub. The required-approval count is a ruleset
  setting. The **target** is 1 eligible approval; it is **not applied yet** because a
  single collaborator cannot approve their own PR, so the ruleset currently requires 0
  and the gap is recorded in `scripts/github/repository-policy.json` and reported on
  every configure run. The admin step to close it (add a second Write collaborator) is
  documented, not silently deferred.

**Versioning**

- `version.json` on each branch is `{ channel, version }`. `main`: `channel: alpha`,
  `version` = the next development `X.Y.0`. `release/vX.Y`: `channel` is
  `beta` → `rc` → `stable` (then the next patch), `version` = the `X.Y.Z` being
  stabilized. CI derives the build version from this file plus the run number; on a
  `stable` channel it is the plain `X.Y.Z`. It is not rewritten per change.
- **Public prerelease tags are an intentional sequence** (`v1.3.0-beta.1`, `-beta.2`,
  `-rc.1`, …) computed from existing tags by the `release` workflow — the CI build
  number is never a public release number.
- Stable and prerelease tags are created only from a `release/vX.Y` branch, never from
  an arbitrary `main` commit.
- Cutting a release line is a manually-triggered workflow that takes the release
  version and the next development version (next minor **or** next major) as explicit
  inputs. It creates `release/vX.Y` **with its own `version.json`** already set to the
  `beta` channel — so the branch's first CI run has a valid version without any
  cross-branch lookup — and advances `main` through a pull request. The
  `required_status_checks` ruleset uses `do_not_enforce_on_create: true` so that
  branch-creating push is allowed while every later push is gated.

## Consequences

- A maintained line can take hotfixes by PR while `main` continues; those fixes are
  forward-ported to `main` and to other maintained lines.
- Everyday feature work carries no review/CI gate beyond what the author chooses —
  only `main` and `release/v*` are gated.
- The minor-vs-major step after a release cut is always stated by a person, never
  inferred by automation.
- Protected-branch configuration is applied and verified through
  [`scripts/github/`](../../../scripts/github/README.md) against the GitHub API.
