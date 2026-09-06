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

Repository access is managed in **GitHub**, not in a file — adding or removing
developers is an admin operation on collaborators/teams. There is no
`.github/CODEOWNERS`.

The **durable target** (in
[`scripts/github/repository-policy.json`](../../scripts/github/repository-policy.json))
is **1 approving review** from an eligible reviewer (write access), stale approvals
dismissed on a new reviewable push, latest push approved, threads resolved.

`configure-repository.mjs` applies that target as soon as the repository has **2+
eligible reviewers**. With only one, it applies a **bootstrap exception** (0 required
approvals — an author cannot approve their own PR) and prints the reason on every run.
Adding a second Write collaborator and re-running the script converges to the target
automatically; the policy file is not edited. See
[`scripts/github/README.md`](../../scripts/github/README.md#review-policy).

Regardless of the approval count, the author self-reviews the full diff before merge: no
unrelated changes, tests and docs updated, `pnpm check` green locally.

For a change that touches a recorded decision
([`architecture/decisions/`](../architecture/decisions/)), update or supersede the ADR
in the same PR.
