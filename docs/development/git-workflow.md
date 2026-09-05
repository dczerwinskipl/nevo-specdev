---
id: development.git-workflow
type: development
title: Git workflow
status: current
read_when:
  - creating a branch
  - preparing a pull request
  - starting a hotfix on a maintained release line
  - deciding how a change reaches main
summary: >
  Branch model (main, feature/, fix/, release/v*), protected-branch rules, squash-merge
  policy, and how maintained release lines and hotfixes work.
related:
  - development.commit-conventions
  - development.pull-requests
  - architecture.repository-structure
  - adr.0003-branch-and-release-model
---

# Git workflow

## Branch model

```text
main                     next development version — always ahead of the latest release
  ← squash-merged PR
  ← feature/<slug>        new capability or behavior
  ← fix/<slug>            bug fix (targets main, or a release line for a hotfix)

release/v<major>.<minor>  one long-lived branch per maintained minor line (e.g. release/v1.3)
```

Short-lived `docs/<slug>` and `chore/<slug>` prefixes follow the same PR rules as
`feature/`.

`release/v1.3` owns the entire `1.3.x` maintenance line: every `1.3.x` patch is a tag
on `release/v1.3`, so the branch name stays at minor granularity.

## Core rules

- **No direct commits to `main` or `release/v*`.** Both are protected; all changes
  arrive by pull request.
- **Squash merge only.** Merge commits and rebase merges are disabled on the repository.
- The **PR title becomes the squash commit message** and must follow
  [Conventional Commits](commit-conventions.md).
- **Checkpoint commits on a feature branch may be informal** — they are squashed away.
  Do not rewrite/force-push someone else's feature branch to "tidy" history.
- **Linear history** is required on protected branches; force-pushes and branch
  deletion are blocked there.
- Review conversations must be **resolved** and required **CI checks green** before a PR
  merges. Merged head branches are deleted automatically.

Feature and fix branches are **not** protected — you can push, rebase and force-push
your own working branch freely.

## Normal change

```bash
git switch main && git pull
git switch -c feature/short-slug
# ... commit freely ...
git push -u origin feature/short-slug
gh pr create --fill        # edit the title to Conventional Commits form
```

## Maintained release lines

A release line is cut with the **`cut-release-line`** GitHub Actions workflow, which
takes explicit inputs (`release line`, `next development version`) rather than inferring
the next version. See [`architecture/repository-structure.md`](../architecture/repository-structure.md)
and ADR [`0003-branch-and-release-model`](../architecture/decisions/0003-branch-and-release-model.md).

```text
release/v1.3  ──►  v1.3.0 ──► v1.3.1 ──► v1.3.2   (tags on the branch)
main          ──►  1.4.0-alpha.<build>  (or 2.0.0-alpha.<build> if the next work breaks compat)
```

## Hotfix on a released line

1. A security/critical issue affects `1.3` while `main` has moved on.
2. `git switch release/v1.3 && git switch -c fix/security-xyz`
3. PR into `release/v1.3` — same review + CI gate, squash merge.
4. Tag `v1.3.1` from `release/v1.3`; publish a GitHub Release from the tag.
5. **Forward-port** the fix to `main` and any other maintained release lines with
   their own PRs.

A hotfix never bypasses review just because it is urgent.
