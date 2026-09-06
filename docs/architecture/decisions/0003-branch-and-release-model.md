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
  collaborators/teams are managed in GitHub. `tools/github/repository-policy.json`
  holds one durable target — **1 eligible approval**, stale reviews dismissed,
  latest-push approval required. `configure-repository.mjs` applies it verbatim when
  the repo has ≥ 2 eligible reviewers; with only 1 it applies a **bootstrap exception**
  (0 approvals) and reports why on every run. Adding a second Write collaborator and
  re-running converges to the target with no policy-file edit.

**Versioning** — full detail in [releasing](../development/releasing.md).

- `version.json` on each branch is `{ channel, version }`. `main` is `alpha` / next
  `X.Y.0`; `release/vX.Y` moves `beta` → `rc` → `stable`, and a `stable` tag also opens
  a PR advancing the branch to the next patch's `beta` so no later commit reports an
  already-shipped `X.Y.Z`. **CI enforces the legal transitions** — an ordinary PR
  cannot hand-edit `version.json` into an illegal state.
- **Public prerelease tags are an intentional sequence** (`v1.3.0-beta.1`, `-beta.2`,
  `-rc.1`, …) computed from existing tags — the CI build number is never a public
  release number.
- Tags are created only from a `release/vX.Y` branch **whose HEAD has passed CI**,
  never from a `main` commit. Tagging is recovery-safe.
- Cutting a release line is a manually-triggered workflow taking the release version
  and the next development version (next minor **or** next major) as explicit inputs.
  It cuts from the current `origin/main` **with the branch's `version.json` committed**
  and advances `main` through a PR. `required_status_checks` uses
  `do_not_enforce_on_create: true` so the branch-creating push is allowed while every
  later push is gated.

## Consequences

- A maintained line can take hotfixes by PR while `main` continues; those fixes are
  forward-ported to `main` and to other maintained lines.
- Everyday feature work carries no review/CI gate beyond what the author chooses —
  only `main` and `release/v*` are gated.
- The minor-vs-major step after a release cut is always stated by a person, never
  inferred by automation.
- Protected-branch configuration is applied and verified through
  [`tools/github/`](../../../tools/github/README.md) against the GitHub API.
