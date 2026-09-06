---
id: development.pull-requests
type: development
title: Pull requests
status: current
read_when:
  - opening a pull request
  - reviewing a pull request
  - understanding why a PR cannot merge
summary: >
  PR template, the merge gate on protected branches, and review expectations for a
  currently single-maintainer repository.
related:
  - development.git-workflow
  - development.commit-conventions
---

# Pull requests

Every change to `main` and `release/v*` is a pull request. Use
[`.github/pull_request_template.md`](../../.github/pull_request_template.md).

## What the template asks for

| Section              | Expectation                                                   |
| -------------------- | ------------------------------------------------------------- |
| Summary              | What changes and why — one short paragraph.                   |
| Changes              | Bullet list of the substantive changes.                       |
| Verification         | Commands run and their result (`pnpm check`, targeted tests). |
| Documentation impact | Docs updated in this PR, or "none — reason".                  |
| Breaking changes     | Mark and describe, or "none".                                 |
| Follow-ups           | Deliberately-deferred work, linked to issues where useful.    |

## Merge gate (protected branches)

A PR into `main` or `release/v*` can merge only when:

- the **PR title** follows [Conventional Commits](commit-conventions.md) (`pr-title` check);
- all **required status checks** pass — `pr-title`, `quality`, `test`, `build` — with the
  **strict / up-to-date** policy, so the branch must also be current with its base;
- there are **no unresolved review conversations**;
- there is **no pending `Request changes` review**;
- there are no merge conflicts (GitHub blocks these on its own — there is no custom check);
- **squash merge** is used (the only method enabled), giving **linear history**.

Merged short-lived branches are deleted automatically. Force-push and branch deletion are
blocked on the protected targets.

## Review policy

Repository access is managed in **GitHub**, not in a file — adding or removing developers
is an admin operation on collaborators/teams. There is no `.github/CODEOWNERS`.

- **Intended (target) policy:** **1 approving review**, from a user GitHub considers
  eligible (write access), with stale approvals dismissed on a new reviewable push and
  the latest push required to be approved.
- **Currently applied:** **0 required approvals.** The repository has a single
  collaborator and GitHub does not let an author approve their own PR, so `1` would make
  every PR unmergeable. This gap is recorded in
  [`scripts/github/repository-policy.json`](../../scripts/github/repository-policy.json)
  (`pullRequest.applied` vs `pullRequest.target`) and printed on every
  `configure-repository.mjs` run.
- **To reach the target:** an admin adds a second collaborator with Write access, then
  sets `pullRequest.applied` = `pullRequest.target` and re-runs the script. See
  [`scripts/github/README.md`](../../scripts/github/README.md#review-policy--applied-vs-target).

Regardless of the approval count, the author self-reviews the full diff before merge: no
unrelated changes, tests and docs updated, `pnpm check` green locally.

For a change that touches a recorded decision
([`architecture/decisions/`](../architecture/decisions/)), update or supersede the ADR
in the same PR.
