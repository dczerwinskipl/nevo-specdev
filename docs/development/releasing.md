---
id: development.releasing
type: development
title: Releasing and version lines
status: current
read_when:
  - understanding what version main or a release branch reports
  - cutting a maintained release line
  - promoting a release branch (beta -> rc -> stable) or starting a patch
  - tagging a beta / rc / stable release
  - applying a hotfix to a released line
summary: >
  The version model (version.json = channel + version), CI-derived build versions, the
  cut-release-line and release workflows, the beta -> rc -> stable -> patch channel
  flow, intentional prerelease tag sequences, and the pre-1.0 policy.
related:
  - architecture.repository-structure
  - adr.0003-branch-and-release-model
  - development.git-workflow
---

# Releasing and version lines

## `version.json` — one schema per branch

```jsonc
{ "channel": "alpha", "version": "0.1.0" }
```

| Branch         | `channel`                                                 | `version`                              |
| -------------- | --------------------------------------------------------- | -------------------------------------- |
| `main`         | `alpha`                                                   | the next development `X.Y.0`           |
| `release/vX.Y` | `beta` → `rc` → `stable`, then repeats for the next patch | the `X.Y.Z` currently being stabilized |

It is **not** rewritten per change. Only cutting a line and promoting a branch edit it,
each through a PR.

## CI build version

`scripts/release/version.mjs` (`pnpm version:print`) derives the build version from
`version.json` + the CI environment:

| Situation                                    | Build version                                                     |
| -------------------------------------------- | ----------------------------------------------------------------- |
| `channel: alpha` / `beta` / `rc`             | `<version>-<channel>.<GITHUB_RUN_NUMBER>` — e.g. `1.3.0-beta.147` |
| `channel: stable`                            | `<version>` — e.g. `1.3.0`                                        |
| ref is a tag `refs/tags/vX.Y.Z[-beta\|rc.N]` | that exact version — never re-derived                             |

`--with-sha` appends `+<short-sha>` build metadata. The run number is a **build
identifier**, not a release number.

## Channels and promotion

```text
main                     alpha
  │  cut-release-line
  ▼
release/v1.3   beta ──promote──▶ rc ──promote──▶ stable
                                                   │  (1.3.0 shipped)
                                                   ▼
                                       rc (or beta) of 1.3.1 ──▶ stable ──▶ 1.3.2 …
```

**Promotion is a one-line edit to `version.json` on the release branch, via a PR.**
`scripts/release/version.mjs` exports `planPromotion` (used by tests) which encodes the
legal transitions:

| From     | To          | Result                               |
| -------- | ----------- | ------------------------------------ |
| `beta`   | `rc`        | same version, channel `rc`           |
| `rc`     | `stable`    | same version, channel `stable`       |
| `stable` | `rc`/`beta` | `version` → next patch, that channel |

Anything else (e.g. `beta` → `stable`, or skipping) is rejected.

## Cutting a release line

Run the **`Cut release line`** workflow (Actions → Run workflow):

| Input                      | Meaning                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| `release_version`          | The version this line stabilizes, e.g. `1.3.0`.                                                        |
| `next_development_version` | Next line for `main` — **next minor** (`1.4.0`) or **next major** (`2.0.0`). Required; never inferred. |
| `from_ref`                 | Commit/ref on `main` to cut from (default: `origin/main`).                                             |
| `execute`                  | Unchecked = validate only. Checked = create the branch + open the PR.                                  |

With `execute` the workflow:

1. validates both versions are plain SemVer and the next is the adjacent minor or major;
2. checks (failing closed on any git/network error) that `release/vX.Y` does not already
   exist and no stale bump PR is open — a half-finished previous run is reported, not
   silently resumed;
3. creates `release/vX.Y` at the chosen `main` commit **plus one commit that sets that
   branch's `version.json` to `{ "channel": "beta", "version": "<release_version>" }`**
   — so the branch's first CI run has a valid version with no cross-branch lookup;
4. opens `chore/bump-main-to-<next>` — a PR that sets `main`'s `version.json` to
   `{ "channel": "alpha", "version": "<next_development_version>" }`.

### Why branch creation is allowed

`release/v*` is protected, but the `required_status_checks` rule is set with
`do_not_enforce_on_create: true`: the one creating push (which cannot go through a PR
and cannot have CI results) is allowed; every later push is fully gated. Deleting the
branch is still blocked. Verified against the live ruleset. To remove a
mistakenly-created release branch, an admin temporarily sets the ruleset's
`enforcement` to `disabled`, deletes it, and re-runs `configure-repository.mjs`.

### The main-bump PR and CI

A PR opened by the default `GITHUB_TOKEN` does **not** trigger workflows, so its
required checks never start and auto-merge cannot complete it. Add a repository secret
**`RELEASE_TOKEN`** (a fine-grained PAT with `contents: write` + `pull requests: write`)
and the workflow uses it for checkout and PR creation; CI then runs and `--auto
--squash` lands it. Without `RELEASE_TOKEN`, the branch and PR are still created — a
maintainer merges the PR by hand. Nothing is silently skipped.

## Releasing a version

Run the **`Release`** workflow **from a `release/vX.Y` branch**:

| Input     | Meaning                    |
| --------- | -------------------------- |
| `channel` | `beta` \| `rc` \| `stable` |
| `execute` | Unchecked = validate only. |

`scripts/release/release.mjs` validates: the branch is a `release/vX.Y`; `version.json`'s
`version` belongs to that line; `version.json`'s `channel` equals the requested channel
(promote first if not). Then it computes the tag:

- `beta` / `rc` → the next number in that channel's sequence for the version, from the
  existing tags — `v1.3.0-beta.1`, then `v1.3.0-beta.2`, then `v1.3.0-rc.1`, …
- `stable` → `v1.3.0` (refused if it already exists)

`execute` creates an annotated tag at the branch HEAD, pushes it, and creates a GitHub
Release (`--prerelease` for beta/rc, notes generated). **No npm package is published.**

## Hotfix on a released line

Branch `fix/<slug>` off `release/vX.Y`, PR back into it (same review + CI gate, squash),
then promote/release: optionally `v1.3.1-rc.1`, then `v1.3.1`. Forward-port the fix to
`main` and other maintained lines with their own PRs.

## Pre-1.0 policy

Before `1.0.0`, breaking changes are allowed without a major bump, but must be
intentional, marked (`!` / `BREAKING CHANGE:`), and documented — see
[repository-structure](../architecture/repository-structure.md#0x-policy). `main` still
carries `0.y.0-alpha.<build>`. Release lines (`release/v0.y`) are cut only once there is
something to maintain separately from `main`.
