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

- the **PR title** follows [Conventional Commits](commit-conventions.md) (checked in CI);
- all **required status checks** pass — `CI / quality`, `CI / test`, `CI / build`;
- the branch is **up to date** with its base when strict checks require it;
- there are **no unresolved review conversations**;
- there is **no pending `Request changes` review**;
- **squash merge** is used (the only method enabled).

Merged branches are deleted automatically. Linear history is enforced.

## Review expectations

This is currently a **single-maintainer** repository. Required-approval count is managed
in the branch ruleset and adjusted through GitHub when additional maintainers join —
see [git-workflow](git-workflow.md) and
[`scripts/github/`](../../scripts/github/README.md). Do not add a self-approval
requirement that a lone maintainer cannot satisfy.

Regardless of the approval count, the author is expected to self-review the full diff
before requesting merge: no unrelated changes, tests and docs updated, `pnpm check`
green locally.

For a change that touches a recorded decision
([`architecture/decisions/`](../architecture/decisions/)), update or supersede the ADR
in the same PR.
